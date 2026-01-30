const CONFIG = {
  accessKey: `${import.meta.env.VITE_UNSPLASH_ACCESS_KEY}`,
  apiUrl: 'https://api.unsplash.com/search/photos',
  perPage: 20
};

const SETTINGS = {
  baseWidth: 400,
  smallHeight: 330,
  largeHeight: 500,
  itemGap: 65,
  hoverScale: 1.05,
  expandedScale: 0.4,
  dragEase: 0.075,
  momentumFactor: 200,
  bufferZone: 3,
  borderRadius: 0,
  vignetteStrength: 0.7,
  vignetteSize: 200,
  overlayOpacity: 0.9,
  overlayEaseDuration: 0.8,
  zoomDuration: 0.6,
  mouseMoveThreshold: 5,
  updateDistanceThreshold: 100,
  updateTimeThreshold: 120
};

let query = "Home Noir";
let imageData = [];

const inappropriateKeywords = [
  'nude', 'naked', 'fuck', 'sex', 'porn', 'xxx', 'adult', 'erotic', 'nsfw',
  'ass', 'dick', 'pussy', 'tits', 'boobs', 'porn star', 'sexual', 'intimate',
  'seductive', 'provocative', 'sensual', 'sexy', 'orgasm', 'masturbation',
  'prostitution', 'brothel', 'escort', 'lgbtq', 'lgbt', 'gay', 'lesbian',
  'bisexual', 'transgender', 'queer', 'homosexual', 'trans', 'pride', 'bitch',
  'rainbow flag', 'violence', 'violent', 'blood', 'gore', 'death', 'kill',
  'murder', 'weapon', 'gun', 'knife', 'war', 'fight', 'brutal', 'torture',
  'assault', 'attack', 'bomb', 'explosion', 'shooting', 'stabbing',
  'massacre', 'slaughter', 'execution', 'homicide', 'genocide', 'rifle',
  'pistol', 'shotgun', 'ammunition', 'bullet', 'grenade', 'sword',
  'machete', 'axe', 'hammer', 'club', 'bat', 'terrorism', 'terrorist',
  'extremist', 'radical', 'jihadist', 'isis', 'al-qaeda', 'taliban',
  'militia', 'insurgent', 'suicide bomber', 'car bomb', 'ied',
  'roadside bomb', 'hostage', 'kidnapping', 'hijack', 'ransom', 'hate',
  'racist', 'discrimination', 'offensive', 'slur', 'nazi', 'fascist',
  'supremacist', 'kkk', 'antisemitic', 'islamophobic', 'xenophobic',
  'bigot', 'prejudice', 'drug', 'cocaine', 'marijuana', 'weed', 'smoking',
  'alcohol', 'beer', 'drunk', 'intoxicated', 'heroin', 'meth', 'crack',
  'opium', 'fentanyl', 'overdose', 'addiction', 'gambling', 'casino',
  'poker', 'betting', 'blackjack', 'roulette', 'slot machine', 'lottery',
  'suicide', 'self-harm', 'depression', 'mental illness', 'cutting',
  'self-injury', 'hanging'
];

function isAppropriateQuery(searchQuery) {
  if (!searchQuery || typeof searchQuery !== 'string') {
    return false;
  }

  const cleanQuery = searchQuery.toLowerCase().replace(/[^a-z0-9\\s]/gi, ' ');
  const words = cleanQuery.split(/\\s+/).filter(word => word.length > 0);

  for (const word of words) {
    if (inappropriateKeywords.includes(word)) {
      return false;
    }

    for (const inappropriate of inappropriateKeywords) {
      if (word.includes(inappropriate) && inappropriate.length > 3) {
        return false;
      }
    }
  }

  return true;
}

function showInappropriateContentWarning(blockedQuery) {
  const warningMessage = `Sorry, the search term "${blockedQuery}" contains inappropriate content and cannot be used. Please try a different search term.`;

  const modalHTML = `
    <div class="content-warning-modal">
      <div class="modal-content">
        <h3>Content Filter</h3>
        <p>${warningMessage}</p>
        <button class="close-modal-btn">OK</button>
      </div>
    </div>
  `;
  
  document.body.insertAdjacentHTML('beforeend', modalHTML);
  const modal = document.body.lastElementChild;

  const closeBtn = modal.querySelector('.close-modal-btn');
  const closeModal = () => {
    modal.remove();
    searchInput.focus();
  };

  closeBtn.addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  const handleOutsideClick = (e) => {
    if (!modal.contains(e.target)) {
      closeModal();
      document.removeEventListener('click', handleOutsideClick);
    }
  };

  setTimeout(() => {
    document.addEventListener('click', handleOutsideClick);
  }, 100);
}

const searchInput = document.querySelector('input');
const searchIcon = document.querySelector('.search-icon');
const categoriesElement = document.getElementById('categories');
const menuIcon = document.getElementById('menu-icon');

const container = document.querySelector(".container");
const canvas = document.getElementById("canvas");
const overlay = document.getElementById("overlay");

gsap.registerPlugin(CustomEase, ScrollToPlugin);
CustomEase.create("hop", "0.9, 0, 0.1, 1");

let itemSizes = [
  { width: SETTINGS.baseWidth, height: SETTINGS.smallHeight },
  { width: SETTINGS.baseWidth, height: SETTINGS.largeHeight }
];
let columns = 4;

let cellWidth = SETTINGS.baseWidth + SETTINGS.itemGap;
let cellHeight = Math.max(SETTINGS.smallHeight, SETTINGS.largeHeight) + SETTINGS.itemGap;

let isDragging = false;
let startX, startY;
let targetX = 0, targetY = 0;
let currentX = 0, currentY = 0;
let dragVelocityX = 0, dragVelocityY = 0;
let lastDragTime = 0;
let mouseHasMoved = false;
let visibleItems = new Set();
let lastUpdateTime = 0;
let lastX = 0, lastY = 0;

let isExpanded = false;
let activeItem = null;
let activeItemId = null;
let canDrag = true;
let originalPosition = null;
let expandedItem = null;
let overlayAnimation = null;

function updateHoverScale() {
  document.documentElement.style.setProperty("--hover-scale", SETTINGS.hoverScale);
  document.querySelectorAll(".item").forEach((item) => {
    const img = item.querySelector("img");
    if (img) img.style.transition = "transform 0.3s ease";
  });
}

function getItemSize(row, col) {
  const sizeIndex = Math.abs((row * columns + col) % itemSizes.length);
  return itemSizes[sizeIndex];
}

function getItemId(col, row) {
  return `${col},${row}`;
}

function getItemPosition(col, row) {
  return { x: col * cellWidth, y: row * cellHeight };
}

function createNewGridItem(col, row, itemNum) {
  if (!imageData.length) return null;

  const imageObject = imageData[itemNum % imageData.length];
  const itemSize = getItemSize(row, col);
  const position = getItemPosition(col, row);
  const userName = imageObject.user.name?.split(',')[0] || `Image ${itemNum + 1}`;
  const imageNumber = `#${(itemNum + 1).toString().padStart(5, "0")}`;
  const altText = imageObject["alt_description"] || `Image ${itemNum + 1}`;
  
  const itemHTML = `
    <div class="item"
         id="${getItemId(col, row)}"
         style="width: ${itemSize.width}px; height: ${itemSize.height}px; left: ${position.x}px; top: ${position.y}px;"
         data-col="${col}"
         data-row="${row}"
         data-width="${itemSize.width}"
         data-height="${itemSize.height}">
      <div class="item-image-container">
        <img src="${imageObject.urls["regular"]}"
             alt="${altText}"
             fetchpriority="high"
             loading="lazy"
        >
      </div>
      <div class="item-caption">
        <div class="item-name">${userName}</div>
        <div class="item-number">${imageNumber}</div>
      </div>
    </div>
  `;
  
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = itemHTML.trim();
  const item = tempDiv.firstChild;

  item.addEventListener("click", () => {
    if (mouseHasMoved || isDragging) return;
    handleItemClick(item, itemNum);
  });

  return item;
}

function updateVisibleItems() {
  const buffer = 1;
  const viewWidth = window.innerWidth;
  const viewHeight = window.innerHeight;

  const startCol = Math.floor((-currentX - viewWidth / 2) / cellWidth) - buffer;
  const endCol = Math.ceil((-currentX + viewWidth / 2) / cellWidth) + buffer;
  const startRow = Math.floor((-currentY - viewHeight / 2) / cellHeight) - buffer;
  const endRow = Math.ceil((-currentY + viewHeight / 2) / cellHeight) + buffer;

  const currentItems = new Set();

  for (let row = startRow; row <= endRow; row++) {
    for (let col = startCol; col <= endCol; col++) {
      const itemId = getItemId(col, row);
      currentItems.add(itemId);

      if (visibleItems.has(itemId)) continue;
      if (activeItemId === itemId && isExpanded) continue;

      const itemNum = Math.abs((row * columns + col) % (imageData.length || 20));
      const item = createNewGridItem(col, row, itemNum);

      if (item) {
        canvas.appendChild(item);
        visibleItems.add(itemId);
      }
    }
  }

  visibleItems.forEach((itemId) => {
    if (!currentItems.has(itemId) || (activeItemId === itemId && isExpanded)) {
      const item = document.getElementById(itemId);
      if (item && item.parentNode === canvas) {
        canvas.removeChild(item);
      }
      visibleItems.delete(itemId);
    }
  });
}

function animateOverlayIn() {
  if (overlayAnimation) overlayAnimation.kill();
  overlayAnimation = gsap.to(overlay, {
    opacity: SETTINGS.overlayOpacity,
    duration: SETTINGS.overlayEaseDuration,
    ease: "power2.inOut",
    overwrite: true
  });
}

function animateOverlayOut() {
  if (overlayAnimation) overlayAnimation.kill();
  overlayAnimation = gsap.to(overlay, {
    opacity: 0,
    duration: SETTINGS.overlayEaseDuration,
    ease: "power2.inOut"
  });
}

function handleItemClick(item, itemIndex) {
  if (isExpanded) {
    if (expandedItem) closeExpandedItem();
  } else {
    expandItem(item, itemIndex);
  }
}

function expandItem(item) {
  isExpanded = true;
  activeItem = item;
  activeItemId = item.id;
  canDrag = false;
  container.style.cursor = "auto";

  const imgSrc = item.querySelector("img").src;
  const imgAltAttribute = item.querySelector("img").alt;
  const itemWidth = parseInt(item.dataset.width);
  const itemHeight = parseInt(item.dataset.height);

  const rect = item.getBoundingClientRect();
  originalPosition = { id: item.id, rect, imgSrc, width: itemWidth, height: itemHeight };

  overlay.classList.add("active");
  animateOverlayIn();

  const expandedHTML = `
    <div class="expanded-item"
         style="width: ${itemWidth}px; height: ${itemHeight}px;">
      <img src="${imgSrc}" alt="${imgAltAttribute}" loading="lazy">
    </div>
  `;
  
  document.body.insertAdjacentHTML('beforeend', expandedHTML);
  expandedItem = document.body.lastElementChild;
  expandedItem.addEventListener("click", closeExpandedItem);

  gsap.set(activeItem, { opacity: 0 });

  document.querySelectorAll(".item").forEach((el) => {
    if (el !== activeItem) {
      gsap.to(el, { opacity: 0, duration: SETTINGS.overlayEaseDuration, ease: "power2.inOut" });
    }
  });

  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  let scaleFactor;
  if (viewportWidth <= 768) {
    scaleFactor = 0.85;
  } else if (viewportWidth <= 1024) {
    scaleFactor = 0.7;
  } else {
    scaleFactor = SETTINGS.expandedScale;
  }

  let targetWidth = viewportWidth * scaleFactor;
  const aspectRatio = itemHeight / itemWidth;
  let targetHeight = targetWidth * aspectRatio;

  const maxHeight = viewportHeight * 0.9;
  if (targetHeight > maxHeight) {
    targetHeight = maxHeight;
    targetWidth = targetHeight / aspectRatio;
  }

  gsap.fromTo(expandedItem, {
    width: itemWidth, height: itemHeight,
    x: rect.left + itemWidth / 2 - window.innerWidth / 2,
    y: rect.top + itemHeight / 2 - window.innerHeight / 2
  }, {
    width: targetWidth, height: targetHeight, x: 0, y: 0,
    duration: SETTINGS.zoomDuration, ease: "hop"
  });
}

function closeExpandedItem() {
  if (!expandedItem || !originalPosition) return;

  animateOverlayOut();

  document.querySelectorAll(".item").forEach((el) => {
    if (el.id !== activeItemId) {
      gsap.to(el, { opacity: 1, duration: SETTINGS.overlayEaseDuration, delay: 0.3, ease: "power2.inOut" });
    }
  });

  const originalRect = originalPosition.rect;
  const originalWidth = originalPosition.width;
  const originalHeight = originalPosition.height;

  gsap.to(expandedItem, {
    width: originalWidth, height: originalHeight,
    x: originalRect.left + originalWidth / 2 - window.innerWidth / 2,
    y: originalRect.top + originalHeight / 2 - window.innerHeight / 2,
    duration: SETTINGS.zoomDuration, ease: "hop",
    onComplete: () => {
      if (activeItem) {
        gsap.set(activeItem, { opacity: 1 });
      }

      setTimeout(() => {
        if (expandedItem && expandedItem.parentNode) {
          document.body.removeChild(expandedItem);
        }

        expandedItem = null;
        isExpanded = false;
        activeItem = null;
        originalPosition = null;
        activeItemId = null;
        canDrag = true;
        container.style.cursor = "grab";
        dragVelocityX = 0;
        dragVelocityY = 0;
        overlay.classList.remove("active");
      }, 100);
    }
  });
}

function animate() {
  if (canDrag) {
    const ease = SETTINGS.dragEase;
    currentX += (targetX - currentX) * ease;
    currentY += (targetY - currentY) * ease;
    canvas.style.transform = `translate(${currentX}px, ${currentY}px)`;

    const now = Date.now();
    const distMoved = Math.sqrt(Math.pow(currentX - lastX, 2) + Math.pow(currentY - lastY, 2));

    if (distMoved > SETTINGS.updateDistanceThreshold || now - lastUpdateTime > SETTINGS.updateTimeThreshold) {
      updateVisibleItems();
      lastX = currentX;
      lastY = currentY;
      lastUpdateTime = now;
    }
  }
  requestAnimationFrame(animate);
}

container.addEventListener("mousedown", (e) => {
  if (!canDrag) return;
  isDragging = true;
  mouseHasMoved = false;
  startX = e.clientX;
  startY = e.clientY;
  container.style.cursor = "grabbing";
});

window.addEventListener("mouseup", () => {
  if (!isDragging) return;
  isDragging = false;

  if (canDrag) {
    container.style.cursor = "grab";
    if (Math.abs(dragVelocityX) > 0.1 || Math.abs(dragVelocityY) > 0.1) {
      const momentumFactor = SETTINGS.momentumFactor;
      targetX += dragVelocityX * momentumFactor;
      targetY += dragVelocityY * momentumFactor;
    }
  }
});

container.addEventListener("touchstart", (e) => {
  if (!canDrag) return;
  isDragging = true;
  mouseHasMoved = false;
  startX = e.touches[0].clientX;
  startY = e.touches[0].clientY;
});

window.addEventListener("touchend", () => {
  isDragging = false;
});

window.addEventListener("wheel", (e) => {
  if (!canDrag) return;
  e.preventDefault();

  const scrollMultiplier = 2;
  targetX -= e.deltaX * scrollMultiplier;
  targetY -= e.deltaY * scrollMultiplier;
}, { passive: false });

window.addEventListener("scroll", (e) => {
  if (!canDrag) return;
  e.preventDefault();
}, { passive: false });

overlay.addEventListener("click", () => {
  if (isExpanded) closeExpandedItem();
});

window.addEventListener("resize", () => {
  if (isExpanded && expandedItem) {
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let scaleFactor;
    if (viewportWidth <= 768) {
      scaleFactor = 0.85;
    } else if (viewportWidth <= 1024) {
      scaleFactor = 0.7;
    } else {
      scaleFactor = SETTINGS.expandedScale;
    }

    const originalWidth = originalPosition.width;
    const originalHeight = originalPosition.height;
    const aspectRatio = originalHeight / originalWidth;

    let targetWidth = viewportWidth * scaleFactor;
    let targetHeight = targetWidth * aspectRatio;

    const maxHeight = viewportHeight * 0.9;
    if (targetHeight > maxHeight) {
      targetHeight = maxHeight;
      targetWidth = targetHeight / aspectRatio;
    }

    gsap.to(expandedItem, {
      width: targetWidth, height: targetHeight,
      duration: 0.3, ease: "power2.out"
    });
  } else {
    updateVisibleItems();
  }
});

function hideCategories() {
  categoriesElement.classList.add('hidden');
  categoriesElement.style.display = 'none';
  menuIcon.setAttribute('aria-expanded', 'false');
}

function fadeCategoriesOut() {
  categoriesElement.classList.add('hidden');
  menuIcon.setAttribute('aria-expanded', 'false');
  setTimeout(() => {
    if (categoriesElement.classList.contains('hidden')) {
      categoriesElement.style.display = 'none';
    }
  }, 500);
}

function showCategories() {
  categoriesElement.style.display = 'block';
  categoriesElement.removeAttribute('inert');
  menuIcon.setAttribute('aria-expanded', 'true');
  requestAnimationFrame(() => {
    categoriesElement.classList.remove('hidden');
  });
  searchInput.focus();
}

function performSearch() {
  const newQuery = searchInput.value.trim();
  if (newQuery === '') return;

  if (!isAppropriateQuery(newQuery)) {
    showInappropriateContentWarning(newQuery);
    searchInput.value = '';
    return;
  }

  query = newQuery;
  document.querySelector('.active.category')?.classList.remove('active');
  hideCategories();
  window.sessionStorage.setItem('query', query);
  loadImages().catch(err => console.error('Error loading images:', err));
  searchInput.value = '';
}

const handleMouseMove = (e) => {
  if (!isDragging || !canDrag) return;
  const dx = e.clientX - startX;
  const dy = e.clientY - startY;

  if (Math.abs(dx) > SETTINGS.mouseMoveThreshold || Math.abs(dy) > SETTINGS.mouseMoveThreshold) {
    mouseHasMoved = true;
  }

  const now = Date.now();
  const dt = Math.max(10, now - lastDragTime);
  lastDragTime = now;

  dragVelocityX = dx / dt;
  dragVelocityY = dy / dt;

  targetX += dx;
  targetY += dy;

  startX = e.clientX;
  startY = e.clientY;
};

const handleTouchMove = (e) => {
  if (!isDragging || !canDrag) return;
  const dx = e.touches[0].clientX - startX;
  const dy = e.touches[0].clientY - startY;

  if (Math.abs(dx) > SETTINGS.mouseMoveThreshold || Math.abs(dy) > SETTINGS.mouseMoveThreshold) {
    mouseHasMoved = true;
  }

  targetX += dx;
  targetY += dy;

  startX = e.touches[0].clientX;
  startY = e.touches[0].clientY;
};

window.addEventListener('click', e => {
  const target = e.target;

  if (target.classList.contains('category')) {
    searchInput.value = '';

    if (target.dataset.keyword === query) {
      if (categoriesElement.classList.contains('hidden')) {
        categoriesElement.style.display = 'block';
        categoriesElement.classList.remove('hidden');
      } else {
        hideCategories();
      }
      return;
    }

    const newCategoryQuery = target.dataset.keyword;

    if (!isAppropriateQuery(newCategoryQuery)) {
      showInappropriateContentWarning(newCategoryQuery);
      return;
    }

    query = newCategoryQuery;
    document.querySelector('.active.category')?.classList.remove('active');
    target.classList.add('active');
    hideCategories();
    window.sessionStorage.setItem('query', query);
    categoriesElement.setAttribute('inert', '');
    loadImages().catch(err => console.error('Error loading images:', err));
    return;
  }

  if (target === categoriesElement || target === document.querySelector('header') || target === document.querySelector('footer')) {
    fadeCategoriesOut();
  }
});

menuIcon.addEventListener('click', () => {
  if (isExpanded) return;

  if (categoriesElement.classList.contains('hidden')) {
    showCategories();
  } else {
    categoriesElement.classList.add('hidden');
    menuIcon.setAttribute('aria-expanded', 'false');
    setTimeout(() => {
      if (categoriesElement.classList.contains('hidden')) {
        categoriesElement.style.display = 'none';
        searchInput.value = '';
      }
    }, 500);
  }
});

searchIcon.addEventListener('click', (e) => {
  e.preventDefault();
  e.stopPropagation();
  performSearch();
});

window.addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    if (searchInput.value.trim() !== '' && document.activeElement === searchInput) {
      performSearch();
    }
  }
  if (e.key === ' ' || e.key === 'Enter') {
    if (document.activeElement) document.activeElement.click();
  }
});

window.addEventListener("mousemove", handleMouseMove);
window.addEventListener("touchmove", handleTouchMove);

function createLoadingScreen() {
  const loadingHTML = `
    <div id="loading-screen" style="
      margin-top: 75px;
      position: fixed;
      inset: 0;
      backdrop-filter: blur(12rem);
      z-index: 1;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      gap: 0.5rem;
      mix-blend-mode: exclusion;
      opacity: 1;
      transition: opacity 0.3s ease-in-out;
      cursor: progress;
    ">
      <div class="loader">
        <div class="cell d-0"></div>
        <div class="cell d-1"></div>
        <div class="cell d-2"></div>
        <div class="cell d-1"></div>
        <div class="cell d-2"></div>
        <div class="cell d-2"></div>
        <div class="cell d-3"></div>
        <div class="cell d-3"></div>
        <div class="cell d-4"></div>
      </div>
      <p id="query-text" style="
        font-size: clamp(1.4rem, 3vw, 1.8rem);
        text-align: center;
        color: white;
        margin: 1rem 0 0 0;
        text-transform: uppercase;
        font-family: inherit;
      ">${query}</p>
    </div>
  `;
  
  document.body.insertAdjacentHTML('beforeend', loadingHTML);
  return document.getElementById('loading-screen');
}

async function removeLoadingScreen() {
  await new Promise(resolve => setTimeout(resolve, 100));

  const loadingScreen = document.getElementById('loading-screen');
  if (!loadingScreen) return;

  const imagePromises = Array.from(document.images).map(img =>
    img.complete && img.naturalHeight !== 0
      ? Promise.resolve()
      : new Promise(resolve => {
          img.addEventListener('load', resolve, { once: true });
          img.addEventListener('error', resolve, { once: true });
        })
  );

  await Promise.all(imagePromises);
  loadingScreen.style.opacity = '0';
  setTimeout(() => {
    if (loadingScreen && loadingScreen.parentNode) {
      loadingScreen.parentNode.removeChild(loadingScreen);
    }
  }, 500);
}

async function loadImages() {
  try {
    menuIcon.disabled = true;

    const loadingScreen = createLoadingScreen();

    const res = await fetch(
      `${CONFIG.apiUrl}?query=${encodeURIComponent(query)}&per_page=${CONFIG.perPage}`,
      {
        headers: {
          'Authorization': `Client-ID ${CONFIG.accessKey}`
        }
      }
    );
    const data = await res.json();

    canvas.innerHTML = '';
    visibleItems.clear();

    currentX = 0;
    currentY = 0;
    targetX = 0;
    targetY = 0;
    canvas.style.transform = 'translate(0px, 0px)';

    imageData = data.results || [];

    initializeStyles();
    updateVisibleItems();

    await removeLoadingScreen();
  } catch (err) {
    console.error("Error loading images:", err);
    const loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen) {
      loadingScreen.style.opacity = '0';
      setTimeout(() => {
        if (loadingScreen && loadingScreen.parentNode) {
          loadingScreen.parentNode.removeChild(loadingScreen);
        }
      }, 300);
    }
  } finally {
    menuIcon.disabled = false;
  }
}

function initializeStyles() {
  updateHoverScale();
}

function initializeCanvasSystem() {
  animate();
  container.style.cursor = "grab";
}

query = window.sessionStorage.getItem('query') || query;
window.sessionStorage.setItem('query', query);
if (query.trim() === 'Galleria Noir') query = 'Galleria Noir';
document.querySelector(`.category[data-keyword="${query}"]`)?.classList.add('active');

loadImages().catch(err => console.error('Error loading images:', err));

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeCanvasSystem);
} else {
  initializeCanvasSystem();
}

document.querySelector('footer #copyright').textContent += new Date().getFullYear();