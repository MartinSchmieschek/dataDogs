export async function saveNode(id: string, code: string) {
  await fetch('/save?id=' + encodeURIComponent(id), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, code })
  });
}
