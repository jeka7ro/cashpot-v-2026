window.toggleMonthMulti = function(e) {
  e.stopPropagation();
  const dd = document.getElementById('dropdown-month-multi');
  if (dd.style.display === 'none' || !dd.style.display) {
    dd.style.display = 'flex';
  } else {
    dd.style.display = 'none';
  }
};

document.addEventListener('click', (e) => {
  const container = document.getElementById('multi-month-container');
  const dd = document.getElementById('dropdown-month-multi');
  if (container && dd && !container.contains(e.target)) {
    dd.style.display = 'none';
  }
});
