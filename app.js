document.addEventListener('DOMContentLoaded', () => {
    const video = document.getElementById('video');
    const videoPlaceholder = document.getElementById('video-placeholder');
    const canvas = document.getElementById('canvas');
    const captureBtn = document.getElementById('capture-btn');
    const flipCameraBtn = document.getElementById('flip-camera-btn');
    const cameraToggleBtn = document.getElementById('camera-toggle-btn');
    const resultsContainer = document.getElementById('results');
    const loadingIndicator = document.getElementById('loading-indicator');
    let currentStream;
    let isFrontCamera = true;
    let isCameraOn = false;

    // Gemini API settings
    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=`;
    const API_KEY = ""; // Canvas will automatically provide the API key
    const RETRY_DELAY_MS = 1000;
    const MAX_RETRIES = 5;

    // Function to handle API calls with exponential backoff
    async function callApiWithBackoff(url, payload, retries = 0) {
        try {
            const response = await fetch(url + API_KEY, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (response.status === 429 && retries < MAX_RETRIES) {
                const delay = RETRY_DELAY_MS * Math.pow(2, retries) + Math.random() * 100;
                console.warn(`Rate limit exceeded. Retrying in ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
                return callApiWithBackoff(url, payload, retries + 1);
            }

            if (!response.ok) {
                throw new Error(`API error: ${response.status} ${response.statusText}`);
            }
            return await response.json();
        } catch (error) {
            console.error("API call failed:", error);
            throw error;
        }
    }

    // Initialize and start the camera
    async function initCamera() {
        if (currentStream) {
            currentStream.getTracks().forEach(track => track.stop());
        }
        const constraints = {
            video: {
                facingMode: isFrontCamera ? 'user' : 'environment'
            }
        };

        try {
            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            currentStream = stream;
            video.srcObject = stream;
            video.play();
            video.classList.remove('hidden');
            videoPlaceholder.classList.add('hidden');
            captureBtn.classList.remove('hidden');
            flipCameraBtn.classList.remove('hidden');
            cameraToggleBtn.innerHTML = '<i class="fas fa-pause mr-2"></i>카메라 중지';
            isCameraOn = true;
        } catch (err) {
            console.error("Error accessing camera: ", err);
            const modal = document.createElement('div');
            modal.className = 'fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center';
            modal.innerHTML = `
                <div class="bg-white p-6 rounded-lg text-center max-w-sm">
                    <p class="text-gray-800 mb-4">카메라 접근 권한이 필요합니다.</p>
                    <button onclick="this.parentElement.parentElement.remove()" class="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-full">확인</button>
                </div>
            `;
            document.body.appendChild(modal);
            videoPlaceholder.textContent = '카메라를 사용할 수 없습니다.';
        }
    }

    // Stop the camera
    function stopCamera() {
        if (currentStream) {
            currentStream.getTracks().forEach(track => track.stop());
        }
        video.pause();
        video.srcObject = null;
        video.classList.add('hidden');
        videoPlaceholder.classList.remove('hidden');
        captureBtn.classList.add('hidden');
        flipCameraBtn.classList.add('hidden');
        cameraToggleBtn.innerHTML = '<i class="fas fa-play mr-2"></i>카메라 시작';
        isCameraOn = false;
    }

    // Toggle camera on/off
    cameraToggleBtn.addEventListener('click', () => {
        if (isCameraOn) {
            stopCamera();
        } else {
            initCamera();
        }
    });

    // Flip camera front/back
    flipCameraBtn.addEventListener('click', () => {
        isFrontCamera = !isFrontCamera;
        initCamera();
    });

    // Capture image
    captureBtn.addEventListener('click', () => {
        if (!isCameraOn) return;
        
        loadingIndicator.classList.remove('hidden');
        resultsContainer.innerHTML = '';
        resultsContainer.appendChild(loadingIndicator);

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext('2d').drawImage(video, 0, 0);
        const imageData = canvas.toDataURL('image/jpeg', 0.9);
        analyzeImage(imageData);
    });

    // Analyze image using Gemini API
    async function analyzeImage(imageData) {
        const base64Data = imageData.split(',')[1];
        const prompt = '이 이미지는 음식입니다. 이 음식에 대해 자세히 설명해 주세요. 음식의 이름, 유래, 주요 특징 등을 포함해 주세요. 한국어로 답변해주세요.';

        const payload = {
            contents: [{
                parts: [
                    { text: prompt },
                    { inlineData: { mimeType: "image/jpeg", data: base64Data } }
                ]
            }]
        };

        try {
            const result = await callApiWithBackoff(API_URL, payload);
            const foodDescription = result?.candidates?.[0]?.content?.parts?.[0]?.text;
            
            if (foodDescription) {
                displayGeminiDescription(foodDescription);
            } else {
                console.error("Gemini API에서 설명을 가져오지 못했습니다.");
            }
        } catch (error) {
            console.error("Gemini API 호출 중 오류 발생:", error);
        }

        // Dummy food name for other functions
        const foodName = 'pizza';
        fetchRecipe(foodName);
        fetchYouTube(foodName);
    }

    // Fetch recipe from TheMealDB API
    async function fetchRecipe(foodName) {
        try {
            const res = await fetch(`https://www.themealdb.com/api/json/v1/1/search.php?s=${foodName}`);
            const data = await res.json();
            displayResults(data.meals);
        } catch (error) {
            console.error("레시피 데이터를 가져오는 중 오류 발생:", error);
        }
    }

    // Fetch videos from YouTube API (requires API key)
    async function fetchYouTube(foodName) {
        try {
            const apiKey = 'YOUR_YOUTUBE_API_KEY';
            // In a real application, replace 'YOUR_YOUTUBE_API_KEY' with a valid API key.
            const res = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&q=${foodName} recipe&key=${apiKey}`);
            const data = await res.json();
            displayVideos(data.items);
        } catch (error) {
            console.error("YouTube 데이터를 가져오는 중 오류 발생:", error);
        }
    }

    // Display food description generated by Gemini
    function displayGeminiDescription(description) {
        loadingIndicator.classList.add('hidden');
        const card = document.createElement('div');
        card.className = 'result-card p-4 mb-4';
        card.innerHTML = `
            <h3 class="text-xl font-semibold text-gray-800 mb-2">AI가 분석한 음식 정보 ✨</h3>
            <p class="text-gray-700 whitespace-pre-wrap">${description}</p>
        `;
        resultsContainer.appendChild(card);
    }

    // Display recipe results on the screen
    function displayResults(meals) {
        loadingIndicator.classList.add('hidden');
        if (!meals) {
            const noResults = document.createElement('p');
            noResults.textContent = '레시피를 찾을 수 없습니다.';
            noResults.className = 'text-center text-gray-500';
            resultsContainer.appendChild(noResults);
            return;
        }

        meals.forEach(meal => {
            const ingredients = [];
            for (let i = 1; i <= 20; i++) {
                const ingredient = meal[`strIngredient${i}`];
                if (ingredient) {
                    ingredients.push(ingredient);
                } else {
                    break;
                }
            }

            const card = document.createElement('div');
            card.className = 'result-card p-4 flex flex-col items-center text-center';
            card.innerHTML = `
                <h3 class="text-xl font-semibold text-gray-800 mb-2">${meal.strMeal}</h3>
                <img src="${meal.strMealThumb}" alt="${meal.strMeal}" class="rounded-lg w-full mb-4 object-cover aspect-video">
                <a href="https://www.themealdb.com/meal.php?c=${meal.idMeal}" target="_blank" class="bg-indigo-500 hover:bg-indigo-600 text-white font-bold py-2 px-4 rounded-full transition-colors mb-4">
                    자세히 보기
                </a>
                <button class="generate-recommendation-btn bg-purple-500 hover:bg-purple-600 text-white font-bold py-2 px-4 rounded-full transition-colors" data-ingredients='${JSON.stringify(ingredients)}'>
                    재료 기반 식단 추천 받기 ✨
                </button>
            `;
            resultsContainer.appendChild(card);
        });

        // Add event listeners for the new buttons
        document.querySelectorAll('.generate-recommendation-btn').forEach(button => {
            button.addEventListener('click', async (event) => {
                const ingredients = JSON.parse(event.target.dataset.ingredients);
                resultsContainer.appendChild(loadingIndicator);
                loadingIndicator.classList.remove('hidden');
                await generateRecommendations(ingredients);
            });
        });
    }

    // Generate recipe recommendations based on ingredients using Gemini API
    async function generateRecommendations(ingredients) {
        const prompt = `다음 재료들을 활용하여 만들 수 있는 3가지 요리 아이디어를 추천해 주세요.
                        ${ingredients.join(', ')}
                        각 요리에 대해 간단한 설명과 재료를 함께 제시해주세요. 한국어로 답변해주세요.`;

        const payload = {
            contents: [{ parts: [{ text: prompt }] }]
        };

        try {
            const result = await callApiWithBackoff(API_URL, payload);
            const recommendations = result?.candidates?.[0]?.content?.parts?.[0]?.text;

            if (recommendations) {
                displayGeminiRecommendations(recommendations);
            } else {
                console.error("Gemini API에서 추천을 가져오지 못했습니다.");
            }
        } catch (error) {
            console.error("Gemini API 호출 중 오류 발생:", error);
        }
    }

    // Display recipe recommendations generated by Gemini
    function displayGeminiRecommendations(recommendations) {
        loadingIndicator.classList.add('hidden');
        const card = document.createElement('div');
        card.className = 'result-card p-4 mt-6';
        card.innerHTML = `
            <h3 class="text-xl font-semibold text-gray-800 mb-2">재료 기반 추천 요리 ✨</h3>
            <div class="text-gray-700 whitespace-pre-wrap">${recommendations}</div>
        `;
        resultsContainer.appendChild(card);
    }

    // Display YouTube video results on the screen
    function displayVideos(videos) {
        loadingIndicator.classList.add('hidden');
        if (!videos || videos.length === 0) {
            return;
        }

        videos.forEach(video => {
            const videoId = video.id.videoId;
            if (videoId) {
                const card = document.createElement('div');
                card.className = 'result-card p-4 flex flex-col items-center text-center';
                card.innerHTML = `
                    <h4 class="text-lg font-medium text-gray-700 mb-2">${video.snippet.title}</h4>
                    <iframe class="w-full aspect-video rounded-lg mb-4" src="https://www.youtube.com/embed/${videoId}" frameborder="0" allowfullscreen></iframe>
                `;
                resultsContainer.appendChild(card);
            }
        });
    }
});
