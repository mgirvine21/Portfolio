// Background grain: a very subtle, slowly drifting grid of tiny stars,
// adapted from the noise-grid section of the original p5.js piece.
// Sits behind page content (section backgrounds < this canvas < .section-inner),
// and stars within a radius of the cursor swell and brighten, easing back
// to rest when the cursor moves away.
//
// Readability: every cell that sits under text or a control is marked in a
// "quiet mask", so stars there stay faint and barely react to the cursor.
// Star arms are capped at half the grid gap, so neighbours can never overlap.

(function () {
	const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

	const TWO_PI = Math.PI * 2;

	const GAP = 35;                 // px between grid cells
	const ARM_CAP = GAP / 2 - 2;    // longest a star arm can reach without touching a neighbour
	const REST_SIZE = 10;           // px, longest arm of a resting grain speck
	const MIN_HOVER_SIZE = 5;       // tiny specks near the cursor still grow to at least this
	const MAX_ALPHA = 0.06;         // resting opacity ceiling
	const DRIFT_SPEED = 0.01;       // noise-field drift per frame

	const HOVER_RADIUS = 150;       // px, reach of the cursor's influence
	const HOVER_ALPHA = 0.16;       // extra opacity at the cursor
	const HOVER_SHARPEN = 0.45;     // how much thinner the star arms get when swelled
	const EASE_IN = 0.18;           // how quickly stars react to the cursor
	const EASE_OUT = 0.06;          // how slowly they settle back

	const QUIET_HOVER = 0.15;       // fraction of the hover effect allowed under text
	const QUIET_ALPHA = 0.45;       // resting opacity multiplier under text
	const QUIET_PAD = 6;            // px of breathing room around masked elements
	const QUIET_SELECTOR = [
		'main h1', 'main h2', 'main h3', 'main h4', 'main p', 'main li',
		'main .eyebrow', 'main .button', 'main figcaption', 'main blockquote',
		'main dt', 'main dd', 'main label', 'main input', 'main textarea',
	].join(',');

	function readPalette() {
		const styles = getComputedStyle(document.documentElement);
		const pick = (name, fallback) => (styles.getPropertyValue(name) || fallback).trim();
		return [pick('--ink', '#23343a'), pick('--violet', '#7c6fa6'), pick('--gold', '#efdb6f')].map(hexToRgb);
	}

	function hexToRgb(hex) {
		const m = hex.replace('#', '');
		const bigint = parseInt(m.length === 3 ? m.split('').map(c => c + c).join('') : m, 16);
		return [(bigint >> 16) & 255, (bigint >> 8) & 255, bigint & 255];
	}

	// Minimal 2D value noise (stand-in for p5's Perlin noise()).
	const gradients = new Map();
	function hashCell(x, y) {
		const key = x + ',' + y;
		let g = gradients.get(key);
		if (g === undefined) {
			const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
			g = s - Math.floor(s);
			gradients.set(key, g);
		}
		return g;
	}
	function smoothstep(t) { return t * t * (3 - 2 * t); }
	function valueNoise(x, y) {
		const x0 = Math.floor(x), y0 = Math.floor(y);
		const sx = smoothstep(x - x0), sy = smoothstep(y - y0);
		const n00 = hashCell(x0, y0), n10 = hashCell(x0 + 1, y0);
		const n01 = hashCell(x0, y0 + 1), n11 = hashCell(x0 + 1, y0 + 1);
		const ix0 = n00 + (n10 - n00) * sx;
		const ix1 = n01 + (n11 - n01) * sx;
		return ix0 + (ix1 - ix0) * sy;
	}

	let canvas, ctx, palette;
	let cols = 0, rows = 0;
	let hover = new Float32Array(0), colorIdx = new Uint8Array(0), quiet = new Uint8Array(0);
	let offset = 0;
	let mouseX = -9999, mouseY = -9999;
	let settled = true;
	let maskQueued = false;

	function drawStar(x, y, radius, innerRadius) {
		const numPoints = 4;
		const angle = TWO_PI / numPoints;
		const halfAngle = angle / 2;
		ctx.beginPath();
		ctx.moveTo(x + radius, y);
		for (let i = 1; i <= numPoints; i++) {
			const prevA = (i - 1) * angle;
			ctx.lineTo(x + Math.cos(prevA + halfAngle) * innerRadius, y + Math.sin(prevA + halfAngle) * innerRadius);
			ctx.lineTo(x + Math.cos(i * angle) * radius, y + Math.sin(i * angle) * radius);
		}
		ctx.closePath();
		ctx.fill();
	}

	function buildQuietMask() {
		maskQueued = false;
		quiet.fill(0);
		const vw = window.innerWidth, vh = window.innerHeight;
		const nodes = document.querySelectorAll(QUIET_SELECTOR);
		for (const node of nodes) {
			const rect = node.getBoundingClientRect();
			if (rect.width === 0 || rect.bottom < -GAP || rect.top > vh + GAP || rect.right < 0 || rect.left > vw) continue;
			// A star at cell (c, r) is centred at GAP/2 + c*GAP; include any cell whose arms could reach the rect.
			const c0 = Math.max(0, Math.floor((rect.left - QUIET_PAD - ARM_CAP) / GAP));
			const c1 = Math.min(cols - 1, Math.floor((rect.right + QUIET_PAD + ARM_CAP) / GAP));
			const r0 = Math.max(0, Math.floor((rect.top - QUIET_PAD - ARM_CAP) / GAP));
			const r1 = Math.min(rows - 1, Math.floor((rect.bottom + QUIET_PAD + ARM_CAP) / GAP));
			for (let c = c0; c <= c1; c++) {
				for (let r = r0; r <= r1; r++) quiet[c * rows + r] = 1;
			}
		}
		wake();
	}

	function queueMask() {
		if (maskQueued) return;
		maskQueued = true;
		requestAnimationFrame(buildQuietMask);
	}

	function resize() {
		const dpr = Math.min(window.devicePixelRatio || 1, 2);
		const w = window.innerWidth, h = window.innerHeight;
		canvas.width = w * dpr;
		canvas.height = h * dpr;
		canvas.style.width = w + 'px';
		canvas.style.height = h + 'px';
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

		cols = Math.ceil(w / GAP);
		rows = Math.ceil(h / GAP);
		hover = new Float32Array(cols * rows);
		quiet = new Uint8Array(cols * rows);
		colorIdx = new Uint8Array(cols * rows);
		for (let c = 0; c < cols; c++) {
			for (let r = 0; r < rows; r++) {
				const x = GAP / 2 + c * GAP, y = GAP / 2 + r * GAP;
				const n = valueNoise(x * 0.01 + 100, y * 0.01 + 100);
				colorIdx[c * rows + r] = Math.floor(n * palette.length) % palette.length;
			}
		}
		buildQuietMask();
		draw();
	}

	function draw() {
		ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
		const scale = 0.03;
		const r2 = HOVER_RADIUS * HOVER_RADIUS;
		let anyActive = false;

		for (let c = 0; c < cols; c++) {
			const x = GAP / 2 + c * GAP;
			for (let r = 0; r < rows; r++) {
				const y = GAP / 2 + r * GAP;
				const i = c * rows + r;
				const isQuiet = quiet[i] === 1;

				const dx = x - mouseX, dy = y - mouseY;
				const d2 = dx * dx + dy * dy;
				let target = d2 < r2 ? smoothstep(1 - Math.sqrt(d2) / HOVER_RADIUS) : 0;
				if (isQuiet) target *= QUIET_HOVER;
				const h = hover[i] + (target - hover[i]) * (target > hover[i] ? EASE_IN : EASE_OUT);
				hover[i] = h < 0.001 ? 0 : h;
				if (hover[i] > 0) anyActive = true;

				const sizeNoise = valueNoise((x + offset) * scale, (y + offset) * scale);
				const restArm = sizeNoise * REST_SIZE;
				const base = Math.max(restArm, hover[i] * MIN_HOVER_SIZE);
				if (base < 0.6) continue;

				// Grow toward the cap rather than multiplying, so arms never cross into the next cell.
				const arm = Math.min(ARM_CAP, base + (ARM_CAP - base) * hover[i]);
				const inner = arm * 0.35 * (1 - hover[i] * HOVER_SHARPEN);
				const restAlpha = (0.4 + sizeNoise * 0.3) * MAX_ALPHA * (isQuiet ? QUIET_ALPHA : 1);
				const alpha = restAlpha + hover[i] * HOVER_ALPHA;

				const [cr, cg, cb] = palette[colorIdx[i]];
				ctx.fillStyle = `rgba(${cr}, ${cg}, ${cb}, ${alpha})`;
				drawStar(x, y, arm, inner);
			}
		}
		return anyActive;
	}

	function loop() {
		offset += DRIFT_SPEED;
		settled = !draw() && reduceMotion;
		if (!settled) requestAnimationFrame(loop);
	}

	function wake() {
		if (settled && canvas) {
			settled = false;
			requestAnimationFrame(loop);
		}
	}

	function init() {
		palette = readPalette();
		canvas = document.createElement('canvas');
		canvas.setAttribute('aria-hidden', 'true');
		canvas.className = 'bg-stars';
		document.body.prepend(canvas);
		ctx = canvas.getContext('2d');
		resize();
		window.addEventListener('resize', resize);
		window.addEventListener('scroll', queueMask, { passive: true });
		window.addEventListener('load', queueMask);
		if ('ResizeObserver' in window) new ResizeObserver(queueMask).observe(document.body);

		window.addEventListener('pointermove', (e) => {
			if (e.pointerType !== 'mouse') return;
			mouseX = e.clientX;
			mouseY = e.clientY;
			wake();
		}, { passive: true });
		document.documentElement.addEventListener('pointerleave', () => {
			mouseX = mouseY = -9999;
		});

		// With reduced motion the field stays still and only animates while the cursor is active.
		settled = reduceMotion;
		if (!reduceMotion) requestAnimationFrame(loop);
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', init);
	} else {
		init();
	}
})();
