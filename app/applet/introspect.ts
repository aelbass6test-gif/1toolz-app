import https from 'https';

const query = `
  query IntrospectionQuery {
    __schema {
      mutationType { name }
      types {
        kind name description
        fields(includeDeprecated: true) {
          name description args { name type { name kind ofType { name kind } } }
        }
      }
    }
  }
`;

const req = https.request('https://graphql.wuilt.com', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' }
}, (res) => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    try {
      const json = JSON.parse(body);
      if (json.data && json.data.__schema && json.data.__schema.mutationType) {
        const mutationTypeName = json.data.__schema.mutationType.name;
        const mutationType = json.data.__schema.types.find(t => t.name === mutationTypeName);
        const orderMutations = mutationType.fields.filter(f => f.name.toLowerCase().includes('order') || f.name.toLowerCase().includes('fulfill') || f.name.toLowerCase().includes('ship'));
        console.log("Found Mutations:", JSON.stringify(orderMutations.map(m => {
            return { name: m.name, args: m.args.map(a => a.name) }
        }), null, 2));
      } else {
        console.log("Could not introspect:", json.errors || body.slice(0, 500));
      }
    } catch (e) {
      console.log("Error parsing:", e.message, body.slice(0, 500));
    }
  });
});

req.on('error', console.error);
req.write(JSON.stringify({ query }));
req.end();
