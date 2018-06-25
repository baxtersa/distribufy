import * as babel from 'babel-core';
import * as t from 'babel-types';
import { NodePath, Scope } from 'babel-traverse';

type FV<T> = T & {
  fvs?: Set<string>;
};

function getFunctionLexicalScope(scope: Scope): Scope | undefined {
  if (scope.path.isFunction()) {
    return scope;
  } else if (scope.path.isBlockStatement() ||
    scope.path.isCatchClause()) {
    return getFunctionLexicalScope(scope.parent);
  } else if (scope.path.isProgram()) {
    return undefined;
  } else {
    throw new Error(`Unexpected scope path of type ${scope.path.node.type}`);
  }
};

function renameFreeReferences(path: NodePath<t.Node>): void {
  const bindings = path.scope.bindings;

  Object.keys(bindings).forEach(id =>
    bindings[id].referencePaths.forEach((refPath: NodePath<t.Identifier>) => {
      const refFnLexicalScope = getFunctionLexicalScope(refPath.scope)
      if (refFnLexicalScope && refFnLexicalScope !== path.scope) {
        const refFnNode = refFnLexicalScope.path.node as t.Function;
        propogateFV(id, refFnLexicalScope, path.scope);
        refPath.replaceWith(accessFV(refPath, refFnNode.id));
      }
    }));
}

function propogateFV(id: string, currentScope: Scope, declaringScope: Scope): void {
  const currentScopeNode: FV<t.Node> = currentScope.path.node;

  if (currentScope !== declaringScope && currentScopeNode.fvs) {
    currentScopeNode.fvs.add(id);
  } else if (currentScope !== declaringScope) {
    currentScopeNode.fvs = new Set([id]);
  }

  const nextScope = getFunctionLexicalScope(currentScope.parent)
  if (nextScope && currentScope !== declaringScope) {
    return propogateFV(id, nextScope, declaringScope);
  }
}

function accessFV(path: NodePath<t.Identifier>, fnId: t.Identifier): t.MemberExpression {
  return t.memberExpression(t.memberExpression(fnId, t.identifier('__free__')), path.node);
}

const visitor = {
  Program(path: NodePath<t.Program>): void {
    renameFreeReferences(path);
  },

  Function: {
    enter(path: NodePath<t.Function>): void {
      renameFreeReferences(path);
    },

    exit(path: NodePath<FV<t.Function>>): void {
      if (path.node.fvs) {
        const { body } = path.node;
        if (!t.isBlockStatement(body)) {
          throw new Error(`Function expected to have block statement body. Found ${body.type}`);
        }
        const declarators = Array.from(path.node.fvs).map(id =>
          t.variableDeclarator(t.identifier(id), t.memberExpression(t.memberExpression(path.node.id, t.identifier('__free__')), t.identifier(id))));
        body.body.unshift(t.variableDeclaration('let', declarators));
        const fvs = t.objectExpression(Array.from(path.node.fvs).map(id =>
          t.objectProperty(t.identifier(id), t.identifier(id), false, true)));
        const assignFVs = t.expressionStatement(t.assignmentExpression('=',
          t.memberExpression(path.node.id, t.identifier('__free__')), fvs));
        path.insertAfter(assignFVs);
      }
    },
  },

  CatchClause(path: NodePath<t.CatchClause>): void {
    const bindings = path.scope.bindings;

    Object.keys(bindings).forEach(id =>
      bindings[id].referencePaths.forEach((refPath: NodePath<t.Identifier>) => {
        const refFnLexicalScope = getFunctionLexicalScope(refPath.scope)
        if (refFnLexicalScope && refFnLexicalScope !== path.scope) {
          const refFnNode = refFnLexicalScope.path.node as t.Function;
          refPath.replaceWith(accessFV(refPath, refFnNode.id));
        }
      }));
  },
};

export default function () {
  return { visitor };
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
