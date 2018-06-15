import * as babel from 'babel-core';
import * as t from 'babel-types';
import { NodePath } from 'babel-traverse';

type State = {
  scopeIdStack: string[],
  localsStack: Set<string>[],
  freeVarsStack: Set<string>[],
};

type RenameState = {
  id: t.Identifier,
  free: Set<string>,
};

const renameReferences = {
  Function: function (path: NodePath<t.Function>): void {
    path.skip();
  },
  ReferencedIdentifier: {
    exit(path: NodePath<t.Identifier>, state: RenameState): void {
      if (!state.free.has(path.node.name)) {
        return;
      }
      path.replaceWith(t.memberExpression(t.memberExpression(
        state.id, t.identifier('__free__')),
        path.node));
      path.skip();
    },
  },
};

function getFunctionId(fn: t.Function): t.Identifier {
  switch (fn.type) {
    case 'ObjectMethod':
      return fn.key as t.Identifier;
    default:
      return fn.id;
  }
}

const visitor = {
  Program: function (this: State): void {
    this.localsStack = [];
    this.freeVarsStack = [];
  },

  Scopable: {
    enter(this: State, path: NodePath<t.Scopable>): void {
      // TODO(slb): Handling of catch clauses is likely wrong. What if a
      // function closes over a var used only within a catch clause?
      if (path.isFunction() || path.isCatchClause() || path.isProgram()) {
        this.localsStack.push(new Set(Object.keys(path.scope.bindings)));
        this.freeVarsStack.push(new Set());
      }
    },

    exit(this: State, path: NodePath<t.Scopable>): void {
      if (path.isFunction() || path.isCatchClause() ||
        path.isProgram()) {
        this.localsStack.pop();
        (<any>path.node).free = this.freeVarsStack.pop();
      }
    },
  },

  Function: {
    exit(path: NodePath<t.Function>): void {
      const id = getFunctionId(path.node);
      const parentNode = path.parent

      const freeObject = t.objectExpression(Array.from((<any>path.node).free).map((name: string) =>
        t.objectProperty(t.identifier(name), t.identifier(name), false, true)));

      path.traverse(renameReferences, {
        id,
        free: (<any>path.node).free,
      });

      if (t.isAssignmentExpression(parentNode) && (<any>path.node).free.size !== 0) {
        const { left } = parentNode;
        const assignFreeVarProperties =
          t.expressionStatement(t.assignmentExpression('=',
            t.memberExpression(left as t.Expression, t.identifier('__free__')),
            freeObject));
        path.getStatementParent().insertAfter(assignFreeVarProperties);
      } else if (t.isVariableDeclarator(parentNode) && (<any>path.node).free.size !== 0) {
        const { id } = parentNode;
        const assignFreeVarProperties =
          t.expressionStatement(t.assignmentExpression('=',
            t.memberExpression(id as t.Expression, t.identifier('__free__')),
            freeObject));
        path.getStatementParent().insertAfter(assignFreeVarProperties);
      } else if ((<any>path.node).free.size !== 0) {
        const assignFreeVarProperties =
          t.expressionStatement(t.assignmentExpression('=',
            t.memberExpression(id, t.identifier('__free__')),
            freeObject));
        path.insertAfter(assignFreeVarProperties);
      }
    },
  },

  ReferencedIdentifier: function (this: State, path: NodePath<t.Identifier>): void {
    path.skip();
    // Return early if the identifier is a label
    if (path.parent.type === 'BreakStatement' ||
      path.parent.type === 'ContinueStatement' ||
      path.parent.type === 'LabeledStatement') {
      return;
    }

    const lastLocals = this.localsStack[this.localsStack.length - 1];
    const lastFree = this.freeVarsStack[this.freeVarsStack.length - 1];

    if (!lastLocals.has(path.node.name)) {
      lastFree.add(path.node.name);
    }
  },
};

export function plugin() {
  return {
    visitor,
  };
}

function main() {
  const filename = process.argv[2];
  const opts = { plugins: [() => ({ visitor })], babelrc: false };
  babel.transformFile(filename, opts, (err, result) => {
    if (err !== null) {
      throw err;
    }
    console.log(result.code);
  });
}

if (require.main === module) {
  main();
}
