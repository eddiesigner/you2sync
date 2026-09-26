<template>
  <div>
    <ol class="list-decimal space-y-1.5 pl-5 text-sm text-muted-foreground">
      <li>Open <a href="https://music.youtube.com" target="_blank" rel="noopener noreferrer" class="text-primary-glow underline">music.youtube.com</a> in a desktop browser and sign in.</li>
      <li>Open the developer tools (F12) and go to the <strong>Network</strong> tab.</li>
      <li>Click around (e.g. open your library) and select any request named <code class="rounded bg-muted px-1">browse</code>.</li>
      <li>Under <strong>Request Headers</strong>, copy the full value of <code class="rounded bg-muted px-1">cookie</code>.</li>
      <li>Paste it below. Signing out of YouTube in that browser invalidates it.</li>
    </ol>
    <p class="mt-3 text-xs text-muted-foreground">
      YouTube Music has no public API for playlists. The cookie is encrypted and stored only on this server, and it is never sent back to the browser.
    </p>
  </div>
</template>
