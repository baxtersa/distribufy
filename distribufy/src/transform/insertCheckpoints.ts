import * as t from 'babel-types';
import { NodePath, Visitor } from 'babel-traverse';

function handleBlock(body: t.BlockStatement) {
  body.body.unshift(t.expressionStatement(
    t.callExpression( t.memberExpression(t.identifier("$__D"),
      t.identifier("checkpoint")), [])));
}

type BlockBody = {
  node: { body: t.BlockStatement }
};

function handleFunction(path: NodePath<t.Node> & BlockBody) {
  if ((<any>path.node).mark === 'Flat') {
    return;
  }
  handleBlock(path.node.body);
}

const visitor: Visitor = {
  FunctionDeclaration(path: NodePath<t.FunctionDeclaration>) {
    handleFunction(path);
  },

  FunctionExpression(path: NodePath<t.FunctionExpression>) {
    handleFunction(path);
  },

  Loop(path: NodePath<t.Loop>) {
    if (path.node.body.type === "BlockStatement") {
      handleBlock(path.node.body);
    }
    else {
      const body = t.blockStatement([path.node.body]);
      path.node.body = body;
      handleBlock(body);
    }
  },
};

export default function () {
  return { visitor };
}
