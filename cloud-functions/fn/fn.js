function main() {
  console.log('before');
  const response = $__D.invoke('http',
    { method: 'GET', uri: 'api.open-notify.org/iss-now.json' })
  console.log('http', response);
  const v = $__D.checkpoint((buf) => ({
      action: '/whisk.system/utils/echo',
      params: { value: 6 },
      state: { $continuation: buf },
    }));
  console.log('after', v);;
  return { v, response };
}

module.exports = main;
