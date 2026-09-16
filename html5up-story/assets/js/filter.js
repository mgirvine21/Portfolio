(function () {
	document.addEventListener('DOMContentLoaded', () => {
		const bar = document.querySelector('.filter-bar');
		if (!bar) return;

		const buttons = bar.querySelectorAll('.filter-button');
		const cards = document.querySelectorAll('.project-card');

		buttons.forEach((btn) => {
			btn.addEventListener('click', () => {
				buttons.forEach((b) => b.classList.remove('filter-active'));
				btn.classList.add('filter-active');

				const filter = btn.dataset.filter;
				cards.forEach((card) => {
					const tags = (card.dataset.tags || '')
						.split(',')
						.map((t) => t.trim());
					card.style.display = (filter === 'all' || tags.includes(filter)) ? '' : 'none';
				});
			});
		});
	});
})();