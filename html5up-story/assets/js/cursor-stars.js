// Custom cursor: floating bezier/vector stars around the mouse.
// Pure Canvas2D + vanilla JS — no p5.js dependency.

(function () {
	// Respect reduced-motion preference, and skip on touch devices
	// (no persistent "hover" position to spawn stars from).
	if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
	if (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) return;

	const TWO_PI = Math.PI * 2;
	const maxStars = 5;

	// Stars only spawn while the cursor is over one of these — add or
	// remove selectors to widen/narrow what counts as "clickable."
	const INTERACTIVE_SELECTOR =
		'a, button, img, input, textarea, select, label, ' +
		'[role="button"], [onclick], .button, .project-card, ' +
		'.gallery-item, .masonry-gallery img, .nav-toggle';

	let canvas, ctx;
	let stars = [];
	let mouseX = 0, mouseY = 0;
	let hasMoved = false;
	let isHoveringInteractive = false;

	function rand(min, max) {
		return Math.random() * (max - min) + min;
	}

	// Box–Muller transform, shaped into the same mean/stdev the original
	// randomGaussian(4, 1.4) call used.
	function randomGaussian(mean, stdev) {
		const u1 = Math.random();
		const u2 = Math.random();
		const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(TWO_PI * u2);
		return z * stdev + mean;
	}

	function clamp(value, min, max) {
		return Math.max(min, Math.min(max, value));
	}

	function getRandomPoints() {
		return clamp(Math.round(randomGaussian(4, 1.4)), 4, 8);
	}

	class Star {
		constructor(x, y, radius, innerRadius, numPoints, curved) {
			this.x = x;
			this.y = y;
			this.radius = radius;
			this.innerRadius = innerRadius;
			this.numPoints = numPoints;
			this.curved = curved;
			this.alpha = rand(120, 255) / 255;
			this.color = `rgb(${rand(200, 255) | 0}, ${rand(200, 255) | 0}, ${rand(200, 255) | 0})`;
			this.creationTime = performance.now();
			const dir = rand(0, TWO_PI);
			// Slower drift than the original piece — these should feel
			// like they're gently floating near the cursor, not zipping off.
			this.dx = Math.cos(dir) * rand(0.15, 0.6);
			this.dy = Math.sin(dir) * rand(0.15, 0.6);
		}

		update() {
			this.x += this.dx;
			this.y += this.dy;
		}

		display() {
			ctx.fillStyle = this.color;
			ctx.globalAlpha = this.alpha;
			drawStar(this.x, this.y, this.radius, this.innerRadius, this.numPoints, this.curved);
			ctx.globalAlpha = 1;
		}

		isDeadOrOffscreen() {
			const age = performance.now() - this.creationTime;
			return (
				this.x < -20 || this.x > canvas.width + 20 ||
				this.y < -20 || this.y > canvas.height + 20 ||
				age > this.lifetime
			);
		}
	}

	// Same construction as the original: outer points connected either
	// by straight lines or quadratic curves through an inner "waist" point.
	function drawStar(x, y, radius, innerRadius, numPoints, curved) {
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
				if (curved) {
					ctx.quadraticCurveTo(xInner, yInner, xOuter, yOuter);
				} else {
					ctx.lineTo(xInner, yInner);
					ctx.lineTo(xOuter, yOuter);
				}
			}
		}
		ctx.closePath();
		ctx.fill();
	}

	function resize() {
		canvas.width = window.innerWidth;
		canvas.height = window.innerHeight;
	}

	function spawnStar() {
		const numPoints = getRandomPoints();
		const curved = Math.random() > 0.7;
		const innerRadius = rand(2, 6);
		const radius = rand(3, 14);
		const x = mouseX + rand(-55, 55);
		const y = mouseY + rand(-55, 55);
		const star = new Star(x, y, radius, innerRadius, numPoints, curved);
		star.lifetime = rand(600, 1500);
		stars.push(star);
	}

	function loop() {
		ctx.clearRect(0, 0, canvas.width, canvas.height);

		if (hasMoved && isHoveringInteractive && stars.length < maxStars) spawnStar();

		for (let i = stars.length - 1; i >= 0; i--) {
			const s = stars[i];
			s.update();
			s.display();
			if (s.isDeadOrOffscreen()) stars.splice(i, 1);
		}

		requestAnimationFrame(loop);
	}

	function init() {
		canvas = document.createElement('canvas');
		Object.assign(canvas.style, {
			position: 'fixed',
			top: '0',
			left: '0',
			pointerEvents: 'none', // let clicks pass through to the page
			zIndex: '9999',        // sit above header/lightbox
		});
		document.body.appendChild(canvas);
		ctx = canvas.getContext('2d');
		resize();

		window.addEventListener('resize', resize);
		window.addEventListener('mousemove', (e) => {
			mouseX = e.clientX;
			mouseY = e.clientY;
			hasMoved = true;

			// The canvas is pointer-events:none, so elementFromPoint sees
			// straight through it to whatever's actually under the cursor.
			const el = document.elementFromPoint(e.clientX, e.clientY);
			isHoveringInteractive = !!(el && el.closest(INTERACTIVE_SELECTOR));
		});

		requestAnimationFrame(loop);
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', init);
	} else {
		init();
	}
})();