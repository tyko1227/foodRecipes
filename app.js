async function initCamera() {
  const video = document.getElementById('video');
  const stream = await navigator.mediaDevices.getUserMedia({ video: true });
  video.srcObject = stream;
}

function captureImage() {
  const canvas = document.getElementById('canvas');
  const video = document.getElementById('video');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext('2d').drawImage(video, 0, 0);
  const imageData = canvas.toDataURL('image/png');
  analyzeImage(imageData);
}

async function analyzeImage(imageData) {
  // TensorFlow.js 모델 로딩 및 분석 로직
  const foodName = 'pizza'; // 예시 결과
  fetchRecipe(foodName);
  fetchYouTube(foodName);
}

async function fetchRecipe(foodName) {
  const res = await fetch(`https://www.themealdb.com/api/json/v1/1/search.php?s=${foodName}`);
  const data = await res.json();
  displayResults(data.meals);
}

async function fetchYouTube(foodName) {
  const apiKey = 'YOUR_YOUTUBE_API_KEY';
  const res = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&q=${foodName}&key=${apiKey}`);
  const data = await res.json();
  displayVideos(data.items);
}

function displayResults(meals) {
  const container = document.getElementById('results');
  meals.forEach(meal => {
    const card = document.createElement('div');
    card.innerHTML = `<h3>${meal.strMeal}</h3><img src="${meal.strMealThumb}">`;
    container.appendChild(card);
  });
}

function displayVideos(videos) {
  const container = document.getElementById('results');
  videos.forEach(video => {
    const card = document.createElement('div');
    card.innerHTML = `<h4>${video.snippet.title}</h4><img src="${video.snippet.thumbnails.default.url}">`;
    container.appendChild(card);
  });
}

initCamera();