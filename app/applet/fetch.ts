import https from 'https';
const req = https.get('https://ais-dev-xcte2r3fyl5agkthujufx4-222930444647.europe-west1.run.app/api/health', (res) => {
  console.log(res.statusCode);
});
