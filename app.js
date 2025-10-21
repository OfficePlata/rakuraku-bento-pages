/**
 * =================================================================
 * らくらく弁当注文アプリ - フロントエンドのロジック
 * -----------------------------------------------------------------
 * このスクリプトは、LIFFアプリのフロントエンドに関する全ての操作
 * (初期化、データ取得、カート管理、注文送信など) を担当します。
 * =================================================================
 */
document.addEventListener('DOMContentLoaded', initializeApp);

// --- ▼▼▼ 設定項目 ▼▼▼ ---
// ★ ご自身のLIFF IDに書き換えてください。
const LIFF_ID = "2008199273-3ogv1YME"; 
// ★ デプロイしたCloudflare WorkerのURLに書き換えてください。
const BACKEND_URL = "https://rakuraku-bento-worker.a-sasahala.workers.dev"; 
// --- ▲▲▲ 設定項目 ▲▲▲ ---

let menuData = [];
let cart = [];
let userProfile = {};
let deliveryAreas = [];
const dom = {}; // DOM要素をキャッシュ（一時保存）しておくオブジェクト

/**
 * LIFFアプリケーションを初期化します。
 */
async function initializeApp() {
  cacheDomElements();
  
  if (!LIFF_ID || LIFF_ID === "YOUR_LIFF_ID_HERE") {
    showError("LIFF IDが設定されていません。app.jsファイルで設定してください。");
    return;
  }
  if (!BACKEND_URL || BACKEND_URL === "YOUR_WORKER_URL_HERE") {
    showError("バックエンドURLが設定されていません。app.jsファイルで設定してください。");
    return;
  }

  try {
    dom.loadingText.textContent = 'LIFFを初期化中...';
    await liff.init({ liffId: LIFF_ID });
    if (!liff.isLoggedIn()) {
      liff.login();
      return;
    }
    userProfile = await liff.getProfile();
    setupEventListeners();
    await fetchInitialData();
  } catch (err) {
    showError(`初期化に失敗しました: ${err.message}`);
  } finally {
    if (dom.loading) dom.loading.style.display = 'none';
  }
}

/**
 * 頻繁に使うDOM要素をキャッシュします。
 */
function cacheDomElements() {
    dom.loading = document.getElementById('loading');
    dom.loadingText = document.getElementById('loading-text');
    dom.menuContainer = document.getElementById('menu-container');
    dom.viewCartButton = document.getElementById('view-cart-button');
    dom.cartItemCount = document.getElementById('cart-item-count');
    dom.cartTotalPrice = document.getElementById('cart-total-price');
    dom.cartModal = document.getElementById('cart-modal');
    dom.closeCartModal = document.getElementById('close-cart-modal');
    dom.submitOrderButton = document.getElementById('submit-order-button');
    dom.cartItemsContainer = document.getElementById('cart-items-container');
    dom.cartModalTotalPrice = document.getElementById('cart-modal-total-price');
    dom.itemDetailModal = document.getElementById('item-detail-modal');
    dom.closeItemDetailModal = document.getElementById('close-item-detail-modal');
    dom.itemDetailName = document.getElementById('item-detail-name');
    dom.itemDetailImg = document.getElementById('item-detail-img');
    dom.itemDetailDescription = document.getElementById('item-detail-description');
    dom.itemDetailOptions = document.getElementById('item-detail-options');
    dom.itemDetailQuantity = document.getElementById('item-detail-quantity');
    dom.itemDetailDecrease = document.getElementById('item-detail-decrease');
    dom.itemDetailIncrease = document.getElementById('item-detail-increase');
    dom.addToCartButton = document.getElementById('add-to-cart-button');
    dom.deliveryOptionRadios = document.querySelectorAll('input[name="delivery-option"]');
    dom.deliveryDetails = document.getElementById('delivery-details');
    dom.deliveryAddress = document.getElementById('delivery-address');
    dom.getLocationButton = document.getElementById('get-location-button');
    dom.deliveryTime = document.getElementById('delivery-time');
    dom.customAlertModal = document.getElementById('custom-alert-modal');
    dom.customAlertTitle = document.getElementById('custom-alert-title');
    dom.customAlertMessage = document.getElementById('custom-alert-message');
    dom.customAlertOkButton = document.getElementById('custom-alert-ok-button');
}


/**
 * 必要なイベントリスナー（クリックなどの監視）をすべて設定します。
 */
function setupEventListeners() {
    dom.viewCartButton.addEventListener('click', openCartModal);
    dom.closeCartModal.addEventListener('click', closeCartModal);
    dom.submitOrderButton.addEventListener('click', confirmAndSubmitOrder);
    dom.cartModal.addEventListener('click', (e) => {
        if (e.target === dom.cartModal) closeCartModal();
    });
    dom.closeItemDetailModal.addEventListener('click', closeItemDetailModal);
    dom.itemDetailModal.addEventListener('click', (e) => {
        if (e.target === dom.itemDetailModal) closeItemDetailModal();
    });
    dom.deliveryOptionRadios.forEach(radio => {
        radio.addEventListener('change', toggleDeliveryDetails);
    });
    dom.getLocationButton.addEventListener('click', getUserLocation);
}

/**
 * バックエンドからメニューと配達エリアの初期データを取得します。
 */
async function fetchInitialData() {
  try {
    dom.loadingText.textContent = 'メニューを取得中...';
    const response = await fetch(`${BACKEND_URL}/api/menu`);
    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`サーバーエラー: ${response.status} - ${errorText}`);
    }
    const data = await response.json();
    if (data.error) throw new Error(data.message);
    
    menuData = data.menu || [];
    deliveryAreas = data.deliveryAreas || [];

    displayMenu();
  } catch (err) {
    showError(`メニューデータの取得に失敗しました: ${err.message}`);
  }
}

/**
 * 取得したメニュー項目を画面に表示します。
 */
function displayMenu() {
  dom.menuContainer.innerHTML = '';
  menuData.forEach(item => {
    const card = document.createElement('div');
    card.className = 'menu-item-card';
    const basePrice = item.options.length > 0 ? item.options[0].price : 'N/A';
    card.innerHTML = `
        <img src="${item.imageUrl || 'https://placehold.co/300x240/eee/ccc?text=No+Image'}" alt="${item.name}">
        <div class="item-info">
            <p class="item-name">${item.name}</p>
            <p class="item-price">¥${basePrice}〜</p>
        </div>
    `;
    card.onclick = () => showItemDetailModal(item);
    dom.menuContainer.appendChild(card);
  });
}

/**
 * 特定のメニュー項目の詳細モーダルを表示します。
 * @param {object} item - メニュー項目のオブジェクト
 */
function showItemDetailModal(item) {
    dom.itemDetailName.textContent = item.name;
    dom.itemDetailImg.src = item.imageUrl || 'https://placehold.co/300x240/eee/ccc?text=No+Image';
    dom.itemDetailDescription.textContent = item.description || '商品説明がありません。';
    dom.itemDetailOptions.innerHTML = '';

    let isFirstOption = true;
    item.options.forEach(opt => {
        if (opt.price && opt.price > 0) {
            const label = document.createElement('label');
            label.className = 'option-label';
            label.innerHTML = `
                <span>${opt.name}</span>
                <span class="option-price">¥${opt.price}</span>
                <input type="radio" name="price-option" value="${opt.sku}" data-name="${opt.name}" data-price="${opt.price}">
            `;
            if (isFirstOption) {
                label.querySelector('input').checked = true;
                isFirstOption = false;
            }
            dom.itemDetailOptions.appendChild(label);
        }
    });

    let quantity = 1;
    dom.itemDetailQuantity.textContent = quantity;
    
    // イベントリスナーが重複しないように、一度クローンして再設定する
    const newDecreaseBtn = dom.itemDetailDecrease.cloneNode(true);
    dom.itemDetailDecrease.parentNode.replaceChild(newDecreaseBtn, dom.itemDetailDecrease);
    dom.itemDetailDecrease = newDecreaseBtn;
    dom.itemDetailDecrease.onclick = () => {
        if (quantity > 1) {
            quantity--;
            dom.itemDetailQuantity.textContent = quantity;
        }
    };

    const newIncreaseBtn = dom.itemDetailIncrease.cloneNode(true);
    dom.itemDetailIncrease.parentNode.replaceChild(newIncreaseBtn, dom.itemDetailIncrease);
    dom.itemDetailIncrease = newIncreaseBtn;
    dom.itemDetailIncrease.onclick = () => {
        quantity++;
        dom.itemDetailQuantity.textContent = quantity;
    };
    
    const newAddToCartBtn = dom.addToCartButton.cloneNode(true);
    dom.addToCartButton.parentNode.replaceChild(newAddToCartBtn, dom.addToCartButton);
    dom.addToCartButton = newAddToCartBtn;
    dom.addToCartButton.onclick = () => {
        const selectedOptionEl = dom.itemDetailOptions.querySelector('input[name="price-option"]:checked');
        if (!selectedOptionEl) {
            showCustomAlert('選択エラー', 'オプションを選択してください。');
            return;
        }
        const selectedOption = {
            sku: selectedOptionEl.value,
            groupName: item.name,
            optionName: selectedOptionEl.dataset.name,
            price: parseInt(selectedOptionEl.dataset.price, 10)
        };
        addToCart(selectedOption, quantity);
        closeItemDetailModal();
    };
    dom.itemDetailModal.classList.add('visible');
}

function closeItemDetailModal() {
    dom.itemDetailModal.classList.remove('visible');
}

/**
 * 商品をショッピングカートに追加します。
 * @param {object} option - 選択された商品のオプション (SKU)
 * @param {number} quantity - 追加する数量
 */
function addToCart(option, quantity) {
  const existingItemIndex = cart.findIndex(cartItem => cartItem.sku === option.sku);
  if (existingItemIndex > -1) {
    cart[existingItemIndex].quantity += quantity;
  } else {
    cart.push({ ...option, quantity });
  }
  updateCartView();
}

/**
 * カートのフッターとモーダルの合計金額などを更新します。
 */
function updateCartView() {
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  
  dom.cartItemCount.textContent = totalItems;
  dom.cartTotalPrice.textContent = totalPrice;
  dom.cartModalTotalPrice.textContent = totalPrice;
  dom.viewCartButton.disabled = cart.length === 0;
}

function openCartModal() {
  renderCartItems();
  dom.cartModal.classList.add('visible');
}

function closeCartModal() {
  dom.cartModal.classList.remove('visible');
}

/**
 * カートモーダル内の商品リストを描画します。
 */
function renderCartItems() {
  if (cart.length === 0) {
    dom.cartItemsContainer.innerHTML = '<p>カートは空です。</p>';
    dom.submitOrderButton.disabled = true;
    return;
  }
  dom.submitOrderButton.disabled = false;
  dom.cartItemsContainer.innerHTML = '';
  cart.forEach((item, index) => {
    const itemEl = document.createElement('div');
    itemEl.className = 'cart-item';
    itemEl.innerHTML = `
        <div class="cart-item-details">
            <p class="cart-item-name">${item.groupName}</p>
            <p class="cart-item-meta">${item.optionName}</p>
            <p class="cart-item-price">¥${item.price * item.quantity}</p>
        </div>
        <div class="cart-item-actions">
            <div class="quantity-controls">
                <button class="quantity-btn" onclick="updateItemQuantity(${index}, -1)">-</button>
                <span class="quantity-display">${item.quantity}</span>
                <button class="quantity-btn" onclick="updateItemQuantity(${index}, 1)">+</button>
            </div>
            <button class="remove-item-btn" onclick="removeItemFromCart(${index})">&times;</button>
        </div>
    `;
    dom.cartItemsContainer.appendChild(itemEl);
  });
  updateCartView();
}

// HTML内のonclickから呼び出せるように、これらの関数をグローバルに公開する
window.updateItemQuantity = (index, change) => {
  cart[index].quantity += change;
  if (cart[index].quantity <= 0) {
    cart.splice(index, 1);
  }
  renderCartItems();
};
window.removeItemFromCart = (index) => {
  cart.splice(index, 1);
  renderCartItems();
};

/**
 * 入力された住所が配達可能エリア内かチェックします。
 * @param {string} address - チェックする住所
 * @returns {boolean}
 */
function isAddressInDeliveryArea(address) {
    if (!address || deliveryAreas.length === 0) {
        return false;
    }
    return deliveryAreas.some(area => address.includes(area));
}

/**
 * 最終的な注文内容を確認し、送信します。
 */
async function confirmAndSubmitOrder() {
  const deliveryMethod = document.querySelector('input[name="delivery-option"]:checked').value;
  let deliveryInfo = {
    method: deliveryMethod,
    address: null,
    time: null
  };

  if (deliveryMethod === 'delivery') {
    const address = dom.deliveryAddress.value.trim();
    const time = dom.deliveryTime.value;

    if (!address) {
      showCustomAlert('入力エラー', '配達先の住所を入力してください。');
      return;
    }
    if (!time) {
      showCustomAlert('入力エラー', '配達希望時間を選択してください。');
      return;
    }
    if (!isAddressInDeliveryArea(address)) {
        showCustomAlert('配達エリア外', '申し訳ございません。ご入力の住所は配達エリア外です。');
        return;
    }
    deliveryInfo.address = address;
    deliveryInfo.time = time;
  }

  dom.submitOrderButton.disabled = true;
  dom.submitOrderButton.textContent = '処理中...';
  const totalPrice = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  
  const orderData = {
    user: {
        userId: userProfile.userId,
        displayName: userProfile.displayName,
    },
    cart: cart, // カートはすでに必要な構造になっています
    totalPrice: totalPrice,
    delivery: deliveryInfo
  };

  try {
    const response = await fetch(`${BACKEND_URL}/api/order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(orderData)
    });
    const result = await response.json();
    if (!response.ok || result.error) {
        throw new Error(result.message || '不明なエラーが発生しました。');
    }
    
    await sendThanksMessage(orderData);
    
    showCustomAlert('らくらく弁当注文', 'ご注文ありがとうございました！', () => {
      liff.closeWindow();
    });

  } catch (err) {
    showCustomAlert('注文エラー', `注文処理中にエラーが発生しました: ${err.message}`);
    dom.submitOrderButton.disabled = false;
    dom.submitOrderButton.textContent = '注文を確定する';
  }
}

/**
 * ユーザーにFlex Messageで注文内容の控えを送信します。
 * @param {object} orderData - 送信された注文データ
 */
async function sendThanksMessage(orderData) {
  if (!liff.isInClient()) return;
  const flexMessage = createReceiptFlexMessage(orderData);
  try {
    await liff.sendMessages([flexMessage]);
  } catch (err) {
    console.error('メッセージの送信に失敗しました:', err);
    showCustomAlert('お知らせ', 'ご注文は受け付けましたが、確認メッセージの送信に失敗しました。');
  }
}

/**
 * 注文内容の控えとなるFlex Messageオブジェクトを作成します。
 * @param {object} orderData - 送信された注文データ
 */
function createReceiptFlexMessage(orderData) {
    const itemDetailsContents = orderData.cart.map(item => ({
        "type": "box", "layout": "horizontal",
        "contents": [
            { "type": "text", "text": `${item.groupName} (${item.optionName})`, "wrap": true, "flex": 3 },
            { "type": "text", "text": `x ${item.quantity}`, "flex": 1, "align": "end" }
        ]
    }));

    let deliveryContents = [];
    if (orderData.delivery.method === 'pickup') {
        deliveryContents.push(
            { "type": "box", "layout": "horizontal", "margin": "md", "contents": [
                { "type": "text", "text": "お受け取り方法", "size": "sm", "color": "#555555", "flex": 1 },
                { "type": "text", "text": "店舗でのお受け取り", "size": "sm", "color": "#111111", "align": "end", "flex": 2 }
            ]}
        );
    } else if (orderData.delivery.method === 'delivery') {
        deliveryContents.push(
            { "type": "box", "layout": "vertical", "margin": "md", "spacing": "sm", "contents": [
                { "type": "box", "layout": "baseline", "contents": [
                    { "type": "text", "text": "お受け取り方法", "size": "sm", "color": "#555555", "flex": 1 },
                    { "type": "text", "text": "配達", "size": "sm", "color": "#111111", "align": "end", "flex": 2 }
                ]},
                { "type": "box", "layout": "baseline", "contents": [
                    { "type": "text", "text": "配達希望時間", "size": "sm", "color": "#555555", "flex": 1 },
                    { "type": "text", "text": orderData.delivery.time, "size": "sm", "color": "#111111", "align": "end", "flex": 2 }
                ]},
                { "type": "box", "layout": "vertical", "contents": [
                    { "type": "text", "text": "配達先住所", "size": "sm", "color": "#555555" },
                    { "type": "text", "text": orderData.delivery.address, "size": "sm", "color": "#111111", "wrap": true, "margin": "sm" }
                ]}
            ]}
        );
    }

    return {
        "type": "flex", "altText": "ご注文内容の確認",
        "contents": {
            "type": "bubble",
            "header": { "type": "box", "layout": "vertical", "contents": [
                { "type": "text", "text": "THANK YOU!", "weight": "bold", "color": "#1DB446", "size": "md" },
                { "type": "text", "text": "ご注文が確定しました", "weight": "bold", "size": "xl", "margin": "md" }
            ]},
            "body": { "type": "box", "layout": "vertical", "contents": [
                { "type": "text", "text": "ご注文内容", "size": "xs", "color": "#aaaaaa" },
                { "type": "separator", "margin": "md" },
                ...itemDetailsContents,
                { "type": "separator", "margin": "lg" },
                ...deliveryContents,
                { "type": "separator", "margin": "lg" },
                { "type": "box", "layout": "horizontal", "contents": [
                    { "type": "text", "text": "合計金額", "weight": "bold" },
                    { "type": "text", "text": `¥${orderData.totalPrice}`, "weight": "bold", "align": "end" }
                ], "margin": "md"}
            ]},
            "styles": { "header": { "backgroundColor": "#F0FFF0" }}
        }
    };
}

/**
 * ユーザーにエラーメッセージを表示します。
 * @param {string} message - 表示するエラーメッセージ
 */
function showError(message) {
    console.error(message);
    if (dom.loading) {
        dom.loadingText.innerHTML = `<p style="color: red; padding: 1em;">エラー: ${message}</p>`;
        dom.loading.style.display = 'flex';
    }
}

function toggleDeliveryDetails() {
    const selectedOption = document.querySelector('input[name="delivery-option"]:checked').value;
    if (selectedOption === 'delivery') {
        dom.deliveryDetails.classList.remove('hidden');
    } else {
        dom.deliveryDetails.classList.add('hidden');
    }
}

/**
 * カスタムアラートモーダルを表示します。
 * @param {string} title - アラートのタイトル
 * @param {string} message - アラートのメッセージ
 * @param {function} [onOkCallback] - OKボタンが押された後のオプションのコールバック関数
 */
function showCustomAlert(title, message, onOkCallback) {
    dom.customAlertTitle.textContent = title;
    dom.customAlertMessage.textContent = message;
    dom.customAlertModal.classList.add('visible');

    const newOkButton = dom.customAlertOkButton.cloneNode(true);
    dom.customAlertOkButton.parentNode.replaceChild(newOkButton, dom.customAlertOkButton);
    dom.customAlertOkButton = newOkButton;

    dom.customAlertOkButton.onclick = () => {
        closeCustomAlert();
        if (typeof onOkCallback === 'function') {
            onOkCallback();
        }
    };
}

function closeCustomAlert() {
    dom.customAlertModal.classList.remove('visible');
}

/**
 * ユーザーの位置情報を取得する処理のエントリーポイントです。
 */
function getUserLocation() {
    if (!navigator.geolocation) {
        showCustomAlert('エラー', 'お使いのブラウザは位置情報機能に対応していません。');
        return;
    }
    acquireLocation();
}

/**
 * Geolocation APIを使用して位置情報を取得します。
 */
async function acquireLocation() {
    dom.getLocationButton.textContent = '...';
    dom.getLocationButton.disabled = true;

    try {
        const position = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
            });
        });
        await reverseGeocode(position.coords.latitude, position.coords.longitude);
    } catch (error) {
        handleGeolocationError(error);
    } finally {
        dom.getLocationButton.textContent = '📍';
        dom.getLocationButton.disabled = false;
    }
}

/**
 * 緯度経度を人間が読める住所に変換します。
 */
async function reverseGeocode(latitude, longitude) {
    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&addressdetails=1&accept-language=ja`);
        if (!response.ok) throw new Error('逆ジオコーディングAPIエラー');
        
        const data = await response.json();
        if (data && data.address) {
            const addr = data.address;
            const postalCode = addr.postcode ? `〒${addr.postcode} ` : '';
            const state = addr.state || '';
            const city = addr.city || addr.town || '';
            const suburb = addr.suburb || '';
            const road = addr.road || '';
            const house_number = addr.house_number || '';

            const addressParts = [state, city, suburb, road, house_number];
            const formattedAddress = `${postalCode}${addressParts.filter(Boolean).join('')}`.trim();

            dom.deliveryAddress.value = formattedAddress || data.display_name;
        } else {
            throw new Error('座標から住所が見つかりませんでした');
        }
    } catch (error) {
        console.error('逆ジオコーディングに失敗:', error);
        showCustomAlert('エラー', '位置情報を住所に変換できませんでした。手動で入力してください。');
    }
}

/**
 * Geolocation APIからのエラーを処理します。
 */
function handleGeolocationError(error) {
    let errorMessage = '';
    switch(error.code) {
        case error.PERMISSION_DENIED:
            errorMessage = '位置情報の利用が拒否されました。\nブラウザやスマートフォンの設定で、このサイトへの位置情報アクセスを許可してください。';
            break;
        case error.POSITION_UNAVAILABLE:
            errorMessage = '位置情報を取得できませんでした。\n電波状況の良い場所で再度お試しください。';
            break;
        case error.TIMEOUT:
            errorMessage = 'リクエストがタイムアウトしました。\n再度お試しください。';
            break;
        default:
            errorMessage = '不明なエラーにより位置情報を取得できませんでした。';
    }
    console.error('位置情報エラー:', error);
    showCustomAlert('位置情報エラー', errorMessage);
}

