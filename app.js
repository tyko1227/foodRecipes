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
    const API_KEY = "AIzaSyCGBRtn7PSq6D5QOkP4_LjVYBpPs2XBk5A"; // Canvas will automatically provide the API key
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
        const prompt = '이 이미지는 음식입니다. 이 음식의 이름을 알려주세요. 그리고 이 음식을 만드는 상세한 레시피를 알려주세요. 한국어로 답변해주세요.';

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
            const foodRecipe = result?.candidates?.[0]?.content?.parts?.[0]?.text;
            
            if (foodRecipe) {
                // Extract food name and display recipe
                const firstLine = foodRecipe.split('\n')[0];
                const foodNameMatch = firstLine.match(/음식 이름: (.+)/);
                const foodName = foodNameMatch ? foodNameMatch[1].trim() : "음식";
                
                displayGeminiRecipe(foodRecipe, foodName);
            } else {
                console.error("Gemini API에서 레시피를 가져오지 못했습니다.");
            }
        } catch (error) {
            console.error("Gemini API 호출 중 오류 발생:", error);
        }
    }

    // Display food recipe generated by Gemini
    function displayGeminiRecipe(recipe, foodName) {
        loadingIndicator.classList.add('hidden');
        const card = document.createElement('div');
        card.className = 'result-card p-4 mb-4';
        card.innerHTML = `
            <h3 class="text-xl font-semibold text-gray-800 mb-2">AI가 분석한 레시피 ✨</h3>
            <p class="text-gray-700 whitespace-pre-wrap mb-4">${recipe}</p>
            <button id="youtube-search-btn" class="w-full bg-red-500 hover:bg-red-600 text-white font-bold py-3 px-6 rounded-full shadow-lg transition-transform transform hover:scale-105 active:scale-95">
              <i class="fab fa-youtube mr-2"></i>유튜브에서 ${foodName} 레시피 검색하기
            </button>
        `;
        resultsContainer.appendChild(card);

        // Add event listener to the YouTube search button
        document.getElementById('youtube-search-btn').addEventListener('click', () => {
            const searchQuery = `${foodName} 레시피`;
            const youtubeUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(searchQuery)}`;
            window.open(youtubeUrl, '_blank');
        });
    }

    // The other functions are no longer needed, but kept for clarity
    function fetchYouTube() {}
    function displayResults() {}
    function displayVideos() {}
});
