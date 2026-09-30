// Mobile nav toggle
const navToggle = document.getElementById('navToggle');
const primaryNav = document.getElementById('primaryNav');

if (navToggle && primaryNav) {
	navToggle.addEventListener('click', () => {
		const isOpen = primaryNav.classList.toggle('is-open');
		navToggle.setAttribute('aria-expanded', String(isOpen));
	});

	primaryNav.querySelectorAll('a').forEach((link) => {
		link.addEventListener('click', () => {
			primaryNav.classList.remove('is-open');
			navToggle.setAttribute('aria-expanded', 'false');
		});
	});
}

// Click-to-play game embed
const gameEmbed = document.getElementById('gameEmbed');
const gameLaunch = document.getElementById('gameLaunch');

if (gameEmbed && gameLaunch) {
	gameLaunch.addEventListener('click', () => {
		const frame = document.createElement('iframe');
		frame.src = gameEmbed.dataset.src;
		frame.title = 'Illuminate - playable game build';
		frame.allow = 'autoplay; fullscreen; gamepad';
		frame.allowFullscreen = true;
		frame.addEventListener('load', () => frame.focus());

		gameEmbed.classList.add('is-playing');
		gameLaunch.replaceWith(frame);
	});
}

// Gallery reveal-on-scroll (single deliberate motion moment, not per-card)
const revealTargets = document.querySelectorAll('.reveal');

if ('IntersectionObserver' in window && revealTargets.length) {
	const observer = new IntersectionObserver(
		(entries) => {
			entries.forEach((entry) => {
				if (entry.isIntersecting) {
					entry.target.classList.add('is-visible');
					observer.unobserve(entry.target);
				}
			});
		},
		{ threshold: 0.15 }
	);

	revealTargets.forEach((target) => observer.observe(target));
} else {
	revealTargets.forEach((target) => target.classList.add('is-visible'));
}
