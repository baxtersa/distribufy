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

const visitor = {
  Program: function (this: State): void {
    this.localsStack = [];
    this.freeVarsStack = [];
  },
  Scopable: {
    enter(this: State, path: NodePath<t.Scopable>): void {
      //console.log(path.scope.bindings)
      //console.log(path.type, path.scope.bindings)
      this.localsStack.push(new Set(Object.keys(path.scope.bindings)));
      this.freeVarsStack.push(new Set());
    },
    exit(this: State, path: NodePath<t.Scopable>): void {
      this.localsStack.pop();
      (<any>path.node).free = this.freeVarsStack.pop();
      if (!path.isFunction() &&
        !path.isProgram()) {
        const lastFree = this.freeVarsStack[this.freeVarsStack.length - 1];
        (<any>path.node).free.forEach((name: string) =>
          lastFree.add(name));
      }
//      console.log(path.type);
//      console.log('free', (<any>path.node).free, '\n');
    },
  },
  Function: {
    exit(path: NodePath<t.Function>): void {
      const { id, body } = path.node;
      if (t.isBlockStatement(body)) {
        const freeObject = t.objectExpression(Array.from((<any>body).free).map((name: string) =>
          t.objectProperty(t.identifier(name), t.identifier(name), false, true)));
        const assignFreeVarProperties =
          t.expressionStatement(t.assignmentExpression('=',
            t.memberExpression(id, t.identifier('__free__')),
            freeObject));

        path.traverse(renameReferences, {
          id,
          free: (<any>body).free,
        });
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

//    console.log('referenced', path.node.name);
//    console.log('bound', lastLocals);
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
