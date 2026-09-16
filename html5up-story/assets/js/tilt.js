(function () {
	const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	if (prefersReduced) return;

	const maxTilt = 10;       // degrees
	const scaleOnHover = 1.03;

	function initTilt(selector) {
		document.querySelectorAll(selector).forEach((card) => {
			card.addEventListener('mouseenter', () => {
				card.style.transition = 'transform 0.1s ease-out';
			});

			card.addEventListener('mousemove', (e) => {
				const rect = card.getBoundingClientRect();
				const x = e.clientX - rect.left;
				const y = e.clientY - rect.top;
				const centerX = rect.width / 2;
				const centerY = rect.height / 2;

				const rotateX = ((centerY - y) / centerY) * maxTilt;
				const rotateY = ((x - centerX) / centerX) * maxTilt;

				card.style.transform =
					`perspective(800px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(${scaleOnHover})`;
			});

			card.addEventListener('mouseleave', () => {
				card.style.transition = 'transform 0.4s ease';
				card.style.transform = 'perspective(800px) rotateX(0) rotateY(0) scale(1)';
			});
		});
	}

	document.addEventListener('DOMContentLoaded', () => {
		initTilt('.project-card');
	});
})();