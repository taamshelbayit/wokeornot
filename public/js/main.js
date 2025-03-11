// Carousel autoplay (optional but recommended)
$('.carousel').carousel({
    interval: 5000
});

// Optional horizontal scrolling buttons
$('.scroll-btn').click(function() {
    const direction = $(this).hasClass('left-btn') ? -1 : 1;
    const scrollTarget = $('#' + $(this).data('target'));
    scrollTarget.animate({
        scrollLeft: scrollTarget.scrollLeft() + (direction * 300)
    }, 400);
});
