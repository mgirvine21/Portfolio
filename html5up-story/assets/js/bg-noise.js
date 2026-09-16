// Background grain: a very subtle, slowly drifting grid of tiny stars,
// adapted from the noise-grid section of the original p5.js piece.
// Sits as a fixed, click-through overlay above the page so it reads
// consistently over both --bg and --bg-alt sections without touching
// any section markup.

(function () {
	if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

	const TWO_PI = Math.PI * 2;

	// Tuning knobs — all deliberately restrained compared to the source
	// piece, since this needs to read as "texture," not "artwork."
	const GAP = 35;          // px between grid cells
	const MAX_SIZE = 15;      // px, largest a grain speck gets
	const MAX_ALPHA = 0.06;  // ~2-5% opacity, per cell (noise scales it down further)
	const DRIFT_SPEED = 0.02; // how fast the noise field drifts per frame
	const FRAME_SKIP = 2;    // only redraw every Nth frame (throttle for a full-page effect)

	// Pull from the site's actual palette so the grain matches instead
	// of introducing new colors. Falls back to sensible defaults if the
	// custom properties aren't found for some reason.
	function readPalette() {
		const styles = getComputedStyle(document.documentElement);
		const pick = (name, fallback) => (styles.getPropertyValue(name) || fallback).trim();
		return [
			pick('--ink', '#23343a'),
			pick('--violet', '#7c6fa6'),
			pick('--gold', '#efdb6f'),
		];
	}

	function hexToRgb(hex) {
		const m = hex.replace('#', '');
		const bigint = parseInt(m.length === 3 ? m.split('').map(c => c + c).join('') : m, 16);
		return [(bigint >> 16) & 255, (bigint >> 8) & 255, bigint & 255];
	}

	// --- Minimal 2D value noise (stand-in for p5's Perlin noise()) ---
	// Smooth, organic-looking variation without pulling in a noise library.
	const gradients = new Map();
	function hashCell(x, y) {
		const key = x + ',' + y;
		let g = gradients.get(key);
		if (!g) {
			// Deterministic-ish pseudo-random value per grid cell.
			const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
			g = s - Math.floor(s);
			gradients.set(key, g);
		}
		return g;
	}
	function smoothstep(t) { return t * t * (3 - 2 * t); }
	function valueNoise(x, y) {
		const x0 = Math.floor(x), y0 = Math.floor(y);
		const x1 = x0 + 1, y1 = y0 + 1;
		const sx = smoothstep(x - x0), sy = smoothstep(y - y0);
		const n00 = hashCell(x0, y0), n10 = hashCell(x1, y0);
		const n01 = hashCell(x0, y1), n11 = hashCell(x1, y1);
		const ix0 = n00 + (n10 - n00) * sx;
		const ix1 = n01 + (n11 - n01) * sx;
		return ix0 + (ix1 - ix0) * sy;
	}

	let canvas, ctx, palette, frame = 0;
	let offsetX = 0, offsetY = 0;

	// Same 4-point-star construction as the original piece.
	function drawStar(x, y, radius, innerRadius) {
		const numPoints = 4;
		const angle = TWO_PI / numPoints;
		const halfAngle = angle / 2;
		ctx.beginPath();
		for (let i = 0; i <= numPoints; i++) {
			const a = i * angle;
			const xOuter = x + Math.cos(a) * radius;
			const yOuter = y + Math.sin(a) * radius;
			if (i === 0) {
				ctx.moveTo(xOuter, yOuter);
			} else {
				const prevA = (i - 1) * angle;
				const xInner = x + Math.cos(prevA + halfAngle) * innerRadius;
				const yInner = y + Math.sin(prevA + halfAngle) * innerRadius;
				ctx.lineTo(xInner, yInner);
				ctx.lineTo(xOuter, yOuter);
			}
		}
		ctx.closePath();
		ctx.fill();
	}

	function resize() {
		canvas.width = window.innerWidth;
		canvas.height = window.innerHeight;
	}

	function draw() {
		ctx.clearRect(0, 0, canvas.width, canvas.height);
		const xScale = 0.03, yScale = 0.03;

		for (let x = GAP / 2; x < canvas.width; x += GAP) {
			for (let y = GAP / 2; y < canvas.height; y += GAP) {
				const sizeNoise = valueNoise((x + offsetX) * xScale, (y + offsetY) * yScale);
				const diameter = sizeNoise * MAX_SIZE;
				if (diameter < 0.6) continue; // skip near-invisible specks entirely

				const colorNoise = valueNoise(x * 0.01 + 100, y * 0.01 + 100);
				const [r, g, b] = hexToRgb(palette[Math.floor(colorNoise * palette.length) % palette.length]);
				const alpha = 0.4 + sizeNoise * 0.3; // vary opacity a bit per speck

				ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha * MAX_ALPHA})`;
				drawStar(x, y, diameter, diameter * 0.35);
			}
		}
	}

	function loop() {
		frame++;
		if (frame % FRAME_SKIP === 0) {
			offsetX += DRIFT_SPEED;
			offsetY += DRIFT_SPEED;
			draw();
		}
		requestAnimationFrame(loop);
	}

	function init() {
		palette = readPalette();
		canvas = document.createElement('canvas');
		Object.assign(canvas.style, {
			position: 'fixed',
			top: '0',
			left: '0',
			pointerEvents: 'none',
			zIndex: '9998', // above all page chrome, just under the cursor effect (9999)
			mixBlendMode: 'multiply', // reads as grain regardless of section bg color
		});
		document.body.prepend(canvas);
		ctx = canvas.getContext('2d');
		resize();
		window.addEventListener('resize', resize);
		requestAnimationFrame(loop);
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', init);
	} else {
		init();
	}
})();