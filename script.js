document.addEventListener('DOMContentLoaded', () => {
    const betButtons = document.querySelectorAll('.bet-amounts .btn');

    betButtons.forEach(button => {
        button.addEventListener('click', () => {
            // Reset all buttons to the dark style
            betButtons.forEach(btn => {
                btn.classList.remove('btn-primary');
                btn.classList.add('btn-primary-dark');
            });

            // Set the clicked button to the primary (active) style
            button.classList.remove('btn-primary-dark');
            button.classList.add('btn-primary');
        });
    });
});
