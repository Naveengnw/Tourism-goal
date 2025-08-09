const form = document.getElementById('feedbackForm');
const messageDiv = document.getElementById('message');

form.addEventListener('submit', async e => {
  e.preventDefault();
  const formData = new FormData(form);

  const res = await fetch('/submit', {
    method: 'POST',
    body: formData
  });

  const result = await res.json();

  if (result.success) {
    messageDiv.textContent = 'Thank you for your feedback!';
    form.reset();
  } else {
    messageDiv.textContent = 'Submission failed: ' + (result.error || 'Unknown error');
  }
});