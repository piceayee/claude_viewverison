// 📌 全域範圍變數
let map;
let markers = [];
let allMarkerCount = 0;

// 📌 JSON 檔案 URL 列表
const jsonUrls = [
    "https://piceayee.github.io/jsonhome/data/0319.json"
];

// 📌 載入所有標記
async function loadAllMarkersFromGitHub() {
    console.log("📥 開始載入所有 JSON 檔案...");
    try {
        const fetchPromises = jsonUrls.map(url =>
            fetch(url).then(response => {
                if (!response.ok) throw new Error(`❌ 無法獲取 JSON: ${url}`);
                return response.json();
            })
        );
        const allData = await Promise.all(fetchPromises);
        console.log("✅ 所有 JSON 載入完成！");

        let rawData = allData.flat();
        let groupedData = [];
        let nameMap = {};

        rawData.forEach(item => {
            if (item.name && item.name !== "未命名照片") {
                if (!nameMap[item.name]) {
                    nameMap[item.name] = { ...item, photoList: [item] };
                    groupedData.push(nameMap[item.name]);
                } else {
                    nameMap[item.name].photoList.push(item);
                }
            } else {
                groupedData.push({ ...item, photoList: [item] });
            }
        });

        groupedData.forEach(markerData => addMarkerToMap(markerData));
        allMarkerCount = markers.length;
        updateCountDisplay();
        filterMarkers();
    } catch (error) {
        console.error("❌ 載入 JSON 失敗：", error);
    }
}

// 📌 更新數量顯示
function updateCountDisplay() {
    const countEl = document.getElementById("photoCount");
    if (countEl) countEl.textContent = `共 ${allMarkerCount} 筆`;
}

// 📌 圖片比例調整（popup 用 CSS 控制，這裡只觸發 update）
function updatePopupStyle(img) {
    const popup = img.closest('.leaflet-popup');
    if (popup && popup._leaflet_popup) popup._leaflet_popup.update();
}

// 📌 標籤顏色
function getCategoryClass(category) {
    switch (category) {
        case "花磚＆裝飾": return "tag-red";
        case "洋樓＆房舍": return "tag-orange";
        case "風獅爺":     return "tag-yellow";
        case "軍事":       return "tag-green";
        case "其他":       return "tag-blue";
        default:           return "tag-purple";
    }
}

// 📌 新增標記到地圖
function addMarkerToMap(markerData) {
    let photos = markerData.photoList || [markerData];
    let isMulti = photos.length > 1;

    // Marker 顏色
    let markerColor = "blue";
    if (markerData.categories) {
        if (markerData.categories.includes("花磚＆裝飾"))      markerColor = "red";
        else if (markerData.categories.includes("洋樓＆房舍")) markerColor = "black";
        else if (markerData.categories.includes("風獅爺"))     markerColor = "yellow";
        else if (markerData.categories.includes("軍事"))       markerColor = "green";
        else if (markerData.categories.includes("其他"))       markerColor = "blue";
    }

    // Popup 圖片 HTML
    let imagesHtml = "";
    if (isMulti) {
        imagesHtml = `<div class="popup-scroll-container">`;
        photos.forEach(p => {
            // data-src 存原始圖片 URL，供 modal 放大用
            imagesHtml += `<img src="${p.image}" data-src="${p.image}" class="popup-image" onload="updatePopupStyle(this);">`;
        });
        imagesHtml += `</div><small style="color:#999;">⬅ 左右滑動查看 (${photos.length}張)</small>`;
    } else {
        imagesHtml = `<img src="${markerData.image}" data-src="${markerData.image}" class="popup-image" onload="updatePopupStyle(this);">`;
    }

    let popupContent = `
        <div class="popup-content">
            <strong>${markerData.name}</strong>
            ${imagesHtml}
            ${markerData.description ? `<div class="popup-desc">${markerData.description}</div>` : ""}
            📅 ${markerData.date || "未知日期"}<br>
            <a href="https://www.google.com/maps?q=${markerData.latitude},${markerData.longitude}" target="_blank" class="gps-link">
                📍 GPS: ${markerData.latitude.toFixed(5)}, ${markerData.longitude.toFixed(5)}
            </a>
        </div>
    `;

    // 建立 Marker
    let marker = L.marker([markerData.latitude, markerData.longitude], {
        icon: L.icon({
            iconUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-${markerColor}.png`,
            iconSize: [25, 41],
            iconAnchor: [12, 41],
            popupAnchor: [1, -34]
        }),
        categories: markerData.categories || []
    })
    .addTo(map)
    .bindPopup(popupContent)
    .on("click", function () {
        let currentZoom = map.getZoom();
        let targetZoom = 17;
        let latOffset = (currentZoom === 17) ? 0.003 : 0.0015;
        if (currentZoom < targetZoom) {
            map.flyTo([markerData.latitude + 0.003, markerData.longitude], targetZoom, { duration: 0.8 });
        } else {
            map.panTo([markerData.latitude + latOffset, markerData.longitude]);
        }
    });

    // 標籤 HTML
    let tagHtml = markerData.categories && markerData.categories.length > 0
        ? markerData.categories.map(cat => `<span class="photo-tag ${getCategoryClass(cat)}">${cat}</span>`).join(" ")
        : `<span class="photo-tag no-category">未分類</span>`;

    marker.categories = markerData.categories || [];
    marker.id = markerData.id;
    markers.push(marker);

    // 側邊列表卡片
    let listItem = document.createElement("div");
    listItem.className = "photo-item";
    listItem.setAttribute("data-id", markerData.id);
    listItem.innerHTML = `
        <div class="photo-thumb-wrap">
            <img src="${markerData.image}" class="thumbnail" alt="${markerData.name}">
            ${isMulti ? `<span class="multi-badge">${photos.length}</span>` : ""}
        </div>
        <div class="photo-info">
            <span class="photo-name">${markerData.name}</span>
            ${markerData.description ? `<p class="photo-desc">${markerData.description}</p>` : ""}
            <div class="category-tags">${tagHtml}</div>
            <button class="go-to-marker">📍 查看位置</button>
        </div>
    `;

    // 點擊「查看位置」按鈕
    listItem.querySelector(".go-to-marker").addEventListener("click", function () {
        map.flyTo([markerData.latitude + 0.01, markerData.longitude], 15, { duration: 0.8 });
        marker.openPopup();
        document.getElementById("map").scrollIntoView({ behavior: "smooth" });
    });

    // 點擊縮圖 → 飛到地圖位置並開啟 popup
    listItem.querySelector(".thumbnail").addEventListener("click", function () {
        map.flyTo([markerData.latitude + 0.0105, markerData.longitude], 15, { duration: 0.8 });
        marker.openPopup();
    });

    document.getElementById("photoList").prepend(listItem);
    return marker;
}

// 📌 篩選標記
function filterMarkers() {
    const activeBtns = Array.from(document.querySelectorAll(".filter-btn.active"));
    const selectedCategories = activeBtns.map(btn => btn.dataset.value);

    let visibleCount = 0;

    markers.forEach(marker => {
        let markerCategories = marker.categories || [];
        let isVisible = false;

        if (selectedCategories.includes("未分類")) {
            isVisible = markerCategories.length === 0;
        } else if (selectedCategories.length > 0) {
            isVisible = selectedCategories.some(cat => markerCategories.includes(cat));
        } else {
            isVisible = true;
        }

        if (isVisible) { marker.addTo(map); visibleCount++; }
        else { map.removeLayer(marker); }

        let photoItem = document.querySelector(`.photo-item[data-id="${marker.id}"]`);
        if (photoItem) photoItem.style.display = isVisible ? "flex" : "none";
    });

    const countEl = document.getElementById("photoCount");
    if (countEl) {
        countEl.textContent = selectedCategories.length > 0
            ? `顯示 ${visibleCount} / ${allMarkerCount} 筆`
            : `共 ${allMarkerCount} 筆`;
    }
}

// 📌 初始化
window.onload = function () {
    // 初始化地圖
    map = L.map("map").setView([24.46, 118.35], 12);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    // URL 參數跳轉
    const urlParams = new URLSearchParams(window.location.search);
    const lat = parseFloat(urlParams.get('lat'));
    const lng = parseFloat(urlParams.get('lng'));
    if (!isNaN(lat) && !isNaN(lng)) map.setView([lat, lng], 18);

    // 載入資料
    loadAllMarkersFromGitHub();

    // ===== Modal 放大檢視 =====
    const modal = document.getElementById("imageModal");
    const fullImage = document.getElementById("fullImage");
    const closeBtn = document.querySelector(".close");

    // 開啟 modal 的函式
    function openModal(src) {
        fullImage.src = src;
        modal.classList.add("open");
        document.body.style.overflow = "hidden"; // 背景禁止滾動
    }

    // 關閉 modal 的函式
    function closeModal() {
        modal.classList.remove("open");
        document.body.style.overflow = "";
    }

    // 點擊 popup 裡的 .popup-image 圖片 → 放大
    // 用事件委派，即使 popup 是動態新增的也能攔截
    document.addEventListener("click", function (e) {
        const target = e.target;
        if (target.classList.contains("popup-image")) {
            // 優先用 data-src（原始尺寸），沒有就用 src
            const src = target.dataset.src || target.src;
            openModal(src);
        }
    });

    // 關閉按鈕
    if (closeBtn) closeBtn.addEventListener("click", closeModal);

    // 點擊背景關閉
    if (modal) modal.addEventListener("click", function (e) {
        if (e.target === modal) closeModal();
    });

    // ESC 鍵關閉
    document.addEventListener("keydown", function (e) {
        if (e.key === "Escape") closeModal();
    });

    // ===== 篩選按鈕 =====
    document.querySelectorAll(".filter-btn").forEach(btn => {
        btn.addEventListener("click", function () {
            this.classList.toggle("active");
            filterMarkers();
        });
    });

    // 隱藏按鈕功能
    const clearBtn = document.getElementById("clearMarkers");
    const reloadBtn = document.getElementById("reloadGitHubData");
    if (clearBtn) clearBtn.addEventListener("click", function () {
        markers.forEach(m => map.removeLayer(m));
        markers = [];
        document.getElementById("photoList").innerHTML = "";
        updateCountDisplay();
    });
    if (reloadBtn) reloadBtn.addEventListener("click", loadAllMarkersFromGitHub);
};
