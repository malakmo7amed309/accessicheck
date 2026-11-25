export const SAMPLES = {
  'Broken landing page': `<!doctype html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1, user-scalable=no">
<style>
  body { font-family: Georgia, serif; margin: 0; background: #fff; color: #222; }
  nav { background: #1b2a41; padding: 14px 24px; display: flex; gap: 18px; }
  nav a { color: #7f93b5; text-decoration: none; }
  .hero { background: #f4d35e; padding: 48px 24px; }
  .hero h3 { font-size: 34px; margin: 0 0 8px; }
  .hero p { color: #b8a44a; font-size: 16px; margin: 0; }
  .card { margin: 24px; padding: 18px; border: 1px solid #ddd; }
  .muted { color: #aaa; font-size: 14px; }
  form { margin: 24px; display: grid; gap: 10px; max-width: 340px; }
  input { padding: 8px; }
  .go { background: #2a9d8f; color: #fff; border: 0; padding: 10px; }
</style>
</head>
<body>
<nav><a href="#">Home</a><a href="#">Menu</a><a href="#"><img src="icon.svg" width="16" height="16"></a></nav>
<div class="hero">
  <h3>Fresh bread, baked at 5 AM</h3>
  <p>Order before midnight and pick up warm.</p>
</div>
<div class="card" id="offer">
  <h5>Today's offer</h5>
  <p class="muted">Two baladi loaves and a croissant for 25 EGP.</p>
  <a href="/offers">Click here</a>
  <img src="bread.jpg" width="120" height="80">
</div>
<form>
  <input type="text" placeholder="Your name">
  <input type="email" id="offer" placeholder="Email">
  <button class="go"></button>
  <a href="/menu" tabindex="3">Full menu</a>
</form>
<table><tr><td>Loaf</td><td>5 EGP</td></tr><tr><td>Croissant</td><td>12 EGP</td></tr></table>
</body>
</html>`,
  'Mostly accessible form': `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Join the book club</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  body { font-family: system-ui, sans-serif; margin: 0; color: #1d2433; }
  main { max-width: 420px; margin: 40px auto; padding: 0 20px; }
  label { display: block; font-weight: 600; margin-top: 14px; }
  input, select { width: 100%; padding: 10px; margin-top: 4px; box-sizing: border-box; }
  button { margin-top: 18px; background: #1f4fd8; color: #fff; border: 0; padding: 12px 18px; border-radius: 6px; }
  .hint { color: #7a8190; font-size: 13px; }
</style>
</head>
<body>
<main>
  <h1>Join the book club</h1>
  <form>
    <label for="n">Full name</label>
    <input id="n" type="text">
    <label for="e">Email</label>
    <input id="e" type="email">
    <p class="hint">We email you the monthly pick. Nothing else.</p>
    <label for="g">Favorite genre</label>
    <select id="g"><option>Fiction</option><option>History</option></select>
    <h4>Preferences</h4>
    <button>Join</button>
  </form>
</main>
</body>
</html>`,
}
