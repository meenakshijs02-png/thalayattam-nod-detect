# THALAYATTAM TECHNOLOGIES — Build Plan

## Goal
Build a complete two-route nostalgic webcore scrapbook experience for a playful Malayali nod-recognition project, with a polished landing page and a fully working mock webcam detection flow.

## What I’ll Build

### Shared visual system
- Replace the template styling with a warm aged-paper palette using cream, olive, dusty pink, soft yellow, muted orange, faded blue, and dark brown.
- Add three coordinated type styles: chunky display, handwritten annotations, and rounded body text.
- Create reusable paper textures, grid-paper layers, tape, imperfect borders, doodles, pixel motifs, labels, focus states, and restrained motion.
- Build a responsive shared header, compact mobile menu, route transitions, and scrapbook footer.

### Home page `/`
- Asymmetrical collage hero with the required headline, copy, calls to action, and a custom retro computer/webcam illustration.
- Hand-drawn labels, arrows, stars, stickers, and humorous research annotations throughout.
- “How it works” sequence with three uneven paper cards and connecting doodle arrows.
- Five-card Malayali Nod Dictionary with unique composition, accent color, copy, and decoration per gesture.
- Research-notebook “Why?” section with the supplied humorous text.
- All navigation links work; section links scroll to their exact section and “Try it” opens `/detect`.

### Detection page `/detect`
- Large reusable webcam interface with permission handling, live preview, frame capture, camera cleanup, and retry controls.
- Complete state sequence: Waiting → Detecting → Analyzing → Result, with scanning, loading, status, and reveal animations.
- Friendly camera, missing-camera, no-face, and backend error presentations.
- Result card with one of five gestures, message, realistic confidence, animated handmade meter, and reset flow.
- Camera stays useful and prominent on mobile.

### API-ready architecture
- Separate camera, visual, status, result, and decorative components.
- Separate gesture prediction service with mock and real implementations behind one `predictGesture()` interface.
- Use `VITE_API_URL` for the future `POST /predict` backend; default to complete mock mode when not configured.
- Keep captured-frame transport compatible with the future Python service without changing the interface.

### Quality checks
- Add unique title, description, Open Graph, and Twitter metadata to both pages.
- Verify keyboard controls, labels, contrast, reduced-motion behavior, camera cleanup, and error recovery.
- Test the live experience at desktop and mobile sizes, including navigation and the full mock detection cycle.

## Technical Notes
- React 19 with TanStack Start routes and Tailwind CSS v4.
- CSS/SVG decorations only; no stock imagery or unnecessary heavy assets.
- Browser `MediaDevices.getUserMedia()` powers the camera; prediction defaults to an in-browser mock service.
- No database or account system is required.
