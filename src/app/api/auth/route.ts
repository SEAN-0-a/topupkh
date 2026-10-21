const formData = new FormData();
formData.append('secret', process.env.TURNSTILE_SECRET_KEY!);
formData.append('response', turnstileToken); // Token sent from frontend

const result = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
  body: formData,
  method: 'POST',
});

const outcome = await result.json();

if (!outcome.success) {
  return new Response(JSON.stringify({ error: 'Turnstile verification failed' }), { status: 400 });
}