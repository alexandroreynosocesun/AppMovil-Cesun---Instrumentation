/**
 * Post-build script for web PWA
 * Run after: expo export --platform web
 * Usage: node scripts/postbuild-web.js
 */
const fs = require('fs');
const path = require('path');

const distDir = path.join(__dirname, '..', 'dist');
const publicDir = path.join(__dirname, '..', 'public');

// 1. Copy all public files to dist (icons, manifest, service-worker)
const publicFiles = fs.readdirSync(publicDir);
publicFiles.forEach(file => {
  if (file === 'index.html') return; // Don't overwrite index.html from public
  const src = path.join(publicDir, file);
  const dest = path.join(distDir, file);
  if (fs.statSync(src).isFile()) {
    fs.copyFileSync(src, dest);
    console.log(`Copied: ${file}`);
  }
});

// 2. Inject iOS PWA meta tags into dist/index.html
const indexPath = path.join(distDir, 'index.html');
let html = fs.readFileSync(indexPath, 'utf-8');

const iosMeta = `
    <!-- PWA Manifest -->
    <link rel="manifest" href="/manifest.json" />

    <!-- iOS PWA Meta Tags -->
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <meta name="apple-mobile-web-app-title" content="CheckApp" />

    <!-- iOS Icons -->
    <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
    <link rel="apple-touch-icon" sizes="152x152" href="/icon-152x152.png" />
    <link rel="apple-touch-icon" sizes="167x167" href="/icon-167x167.png" />
    <link rel="apple-touch-icon" sizes="180x180" href="/icon-180x180.png" />

    <!-- iOS Splash Screens -->
    <link rel="apple-touch-startup-image" media="(device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2)" href="/splash-750x1334.png" />
    <link rel="apple-touch-startup-image" media="(device-width: 375px) and (device-height: 812px) and (-webkit-device-pixel-ratio: 3)" href="/splash-1125x2436.png" />
    <link rel="apple-touch-startup-image" media="(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 2)" href="/splash-828x1792.png" />
    <link rel="apple-touch-startup-image" media="(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3)" href="/splash-1170x2532.png" />
    <link rel="apple-touch-startup-image" media="(device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3)" href="/splash-1179x2556.png" />
    <link rel="apple-touch-startup-image" media="(device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3)" href="/splash-1290x2796.png" />
    <link rel="apple-touch-startup-image" media="(device-width: 428px) and (device-height: 926px) and (-webkit-device-pixel-ratio: 3)" href="/splash-1284x2778.png" />

    <!-- Disable phone number detection -->
    <meta name="format-detection" content="telephone=no" />`;

// Only inject if not already present
if (!html.includes('apple-mobile-web-app-capable')) {
  // Replace theme-color value to match dark theme
  html = html.replace(
    /content="#2196F3"/,
    'content="#0F0F0F"'
  );

  // Fix viewport for iOS standalone
  html = html.replace(
    /name="viewport"[^>]*>/,
    'name="viewport" content="width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />'
  );

  // Inject iOS meta tags before </head>
  html = html.replace('</head>', iosMeta + '\n  </head>');

  // Add iOS-friendly body styles with safe areas
  const iosStyles = `
      body {
        background-color: #0F0F0F;
        -webkit-tap-highlight-color: transparent;
        -webkit-touch-callout: none;
        -webkit-user-select: none;
        user-select: none;
        padding-top: env(safe-area-inset-top);
        padding-bottom: env(safe-area-inset-bottom);
        padding-left: env(safe-area-inset-left);
        padding-right: env(safe-area-inset-right);
      }
      #root {
        height: 100dvh;
      }`;

  html = html.replace('</style>', iosStyles + '\n    </style>');

  // Add service worker registration before </body>
  const swScript = `
    <script>
      if ('serviceWorker' in navigator) {
        window.addEventListener('load', function() {
          navigator.serviceWorker.register('/service-worker.js');
        });
      }
    </script>`;

  if (!html.includes('serviceWorker')) {
    html = html.replace('</body>', swScript + '\n  </body>');
  }

  // Add Apple Keychain form wrapper script
  const keychainScript = `
    <script>
      // Apple Keychain: wrap login inputs in a <form> so Safari detects credentials
      var observer = new MutationObserver(function() {
        var inputs = document.querySelectorAll('input[autocomplete="username"], input[autocomplete="current-password"]');
        if (inputs.length >= 2) {
          var usernameInput = inputs[0];
          if (usernameInput.closest('form')) return;
          var form = document.createElement('form');
          form.setAttribute('method', 'post');
          form.setAttribute('action', '#');
          form.style.display = 'contents';
          form.addEventListener('submit', function(e) { e.preventDefault(); });
          var commonParent = usernameInput.parentElement.parentElement.parentElement;
          if (commonParent && commonParent.parentElement) {
            commonParent.parentElement.insertBefore(form, commonParent);
            form.appendChild(commonParent);
            observer.disconnect();
          }
        }
      });
      observer.observe(document.getElementById('root'), { childList: true, subtree: true });
    </script>`;

  if (!html.includes('Apple Keychain')) {
    html = html.replace('</body>', keychainScript + '\n  </body>');
  }

  fs.writeFileSync(indexPath, html);
  console.log('Injected iOS PWA meta tags into index.html');
} else {
  console.log('iOS PWA meta tags already present');
}

console.log('Post-build complete!');
