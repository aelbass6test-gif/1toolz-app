async function run() {
    const res = await fetch("http://localhost:3000/api/sync/platform/wuilt/store-1778212844642-kmq6cpc?type=orders", {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        }
    });
    const text = await res.text();
    console.log(text);
}
run();
