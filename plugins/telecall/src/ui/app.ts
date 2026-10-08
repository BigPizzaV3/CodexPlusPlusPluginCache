import { conversationManager, ChatMessage } from '../agent/conversation';
import { ALL_PRODUCTS } from '../catalog/catalog';
import { TeleCallProduct } from '../types/product';
import { formatFiberSpeed, formatMobileData, formatTelevisionSummary } from '../utils/formatting';
import { analyticsService } from '../services/analyticsService';

document.addEventListener('DOMContentLoaded', () => {
  const chatContainer = document.getElementById('chatContainer')!;
  const chatForm = document.getElementById('chatForm') as HTMLFormElement;
  const userInput = document.getElementById('userInput') as HTMLInputElement;
  const quickChips = document.getElementById('quickChips')!;
  const quickScenarios = document.getElementById('quickScenarios')!;
  const btnResetChat = document.getElementById('btnResetChat')!;
  const btnViewCatalog = document.getElementById('btnViewCatalog')!;
  const catalogModal = document.getElementById('catalogModal')!;
  const closeModal = document.getElementById('closeModal')!;
  const productsGrid = document.getElementById('productsGrid')!;
  const tabButtons = document.querySelectorAll('.tab-btn');

  // Submit message handler
  chatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const query = userInput.value.trim();
    if (!query) return;

    sendMessage(query);
    userInput.value = '';
  });

  // Scenario buttons
  quickScenarios.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest('.scenario-btn') as HTMLButtonElement;
    if (btn && btn.dataset.query) {
      sendMessage(btn.dataset.query);
    }
  });

  // Reset Chat
  btnResetChat.addEventListener('click', () => {
    conversationManager.reset();
    chatContainer.innerHTML = `
      <div class="message-row assistant">
        <div class="avatar">T</div>
        <div class="bubble">
          <div class="welcome-card">
            <img src="/assets/telecall_banner.jpg" alt="TeleCall AI Advisor Banner" class="welcome-banner" onerror="this.style.display='none'">
            <h3>Conversación reiniciada</h3>
            <p>Hola de nuevo. Cuéntame qué necesitas y te ayudaré a encontrar la mejor tarifa de telecomunicaciones.</p>
          </div>
        </div>
      </div>
    `;
    quickChips.innerHTML = '';
  });

  // Catalog Modal Handlers
  btnViewCatalog.addEventListener('click', () => {
    renderCatalogGrid('all');
    catalogModal.style.display = 'flex';
  });

  closeModal.addEventListener('click', () => {
    catalogModal.style.display = 'none';
  });

  catalogModal.addEventListener('click', (e) => {
    if (e.target === catalogModal) {
      catalogModal.style.display = 'none';
    }
  });

  tabButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      tabButtons.forEach(b => b.classList.remove('active'));
      const target = e.currentTarget as HTMLButtonElement;
      target.classList.add('active');
      const tab = target.dataset.tab || 'all';
      renderCatalogGrid(tab);
    });
  });

  function sendMessage(query: string) {
    // 1. Render User Message
    appendMessage({
      id: `u_${Date.now()}`,
      sender: 'user',
      text: query,
      timestamp: new Date().toISOString()
    });

    // 2. Process with ConversationManager
    const response = conversationManager.handleUserMessage(query);

    // 3. Render Assistant Response
    setTimeout(() => {
      appendMessage(response);
      renderQuickChips(response.quickActions || []);
    }, 250);
  }

  function appendMessage(msg: ChatMessage) {
    const row = document.createElement('div');
    row.className = `message-row ${msg.sender}`;

    const avatar = document.createElement('div');
    avatar.className = 'avatar';
    avatar.textContent = msg.sender === 'user' ? 'U' : 'T';

    const bubble = document.createElement('div');
    bubble.className = 'bubble';

    // Parse markdown-like paragraphs and formatting
    const formattedHtml = formatMessageText(msg.text);
    bubble.innerHTML = formattedHtml;

    // If recommendation has product cards, render them as interactive cards
    if (msg.recommendationResult && msg.recommendationResult.recommendations.length > 0) {
      const cardsGrid = document.createElement('div');
      cardsGrid.className = 'rec-cards-grid';

      msg.recommendationResult.recommendations.forEach((rec, idx) => {
        const card = createProductCard(rec.primaryProduct, rec.pricing.totalMonthly, idx === 0);
        cardsGrid.appendChild(card);
      });

      bubble.appendChild(cardsGrid);
    }

    row.appendChild(avatar);
    row.appendChild(bubble);
    chatContainer.appendChild(row);
    chatContainer.scrollTop = chatContainer.scrollHeight;
  }

  function createProductCard(product: TeleCallProduct, totalMonthly?: number, isLowestPrice?: boolean): HTMLElement {
    const card = document.createElement('div');
    card.className = `product-card ${isLowestPrice ? 'best-price' : ''}`;

    const displayPrice = totalMonthly !== undefined ? totalMonthly : (product.price?.monthly || 0);

    card.innerHTML = `
      ${isLowestPrice ? '<span class="card-badge">Menor Precio</span>' : ''}
      <h4 class="card-title">${product.name}</h4>
      <div class="card-price">
        <span class="price-amount">${displayPrice} €</span>
        <span class="price-period">/mes</span>
      </div>
      <div class="card-specs">
        ${product.fiber ? `<div class="spec-row">⚡ <strong>Fibra:</strong> ${formatFiberSpeed(product.fiber.speedMbps)}</div>` : ''}
        ${product.mobile?.dataGB ? `<div class="spec-row">📱 <strong>Móvil:</strong> ${formatMobileData(product.mobile.dataGB)} 5G + Ilimitadas</div>` : ''}
        ${product.television ? `<div class="spec-row">📺 <strong>TV:</strong> ${formatTelevisionSummary(product)}</div>` : ''}
        <div class="spec-row">🔒 <strong>Condición:</strong> Sin permanencia</div>
      </div>
      <div class="card-actions">
        <button class="card-btn outline btn-details" data-id="${product.id}">Ver detalles</button>
        <button class="card-btn primary btn-select" data-name="${product.name}">Elegir opción</button>
      </div>
    `;

    card.querySelector('.btn-select')?.addEventListener('click', () => {
      analyticsService.logEvent('product_viewed', { productId: product.id, productName: product.name });
      sendMessage(`Me interesa la opción "${product.name}". ¿Qué pasos siguen?`);
    });

    card.querySelector('.btn-details')?.addEventListener('click', () => {
      sendMessage(`Explícame en detalle las características y condiciones de "${product.name}"`);
    });

    return card;
  }

  function renderQuickChips(chips: string[]) {
    quickChips.innerHTML = '';
    chips.forEach(chip => {
      const btn = document.createElement('button');
      btn.className = 'chip-btn';
      btn.textContent = chip;
      btn.addEventListener('click', () => {
        sendMessage(chip);
      });
      quickChips.appendChild(btn);
    });
  }

  function renderCatalogGrid(filterType: string) {
    productsGrid.innerHTML = '';
    const filtered = filterType === 'all'
      ? ALL_PRODUCTS
      : ALL_PRODUCTS.filter(p => p.type === filterType);

    filtered.forEach(product => {
      const card = createProductCard(product);
      productsGrid.appendChild(card);
    });
  }

  function formatMessageText(text: string): string {
    return text
      .replace(/### (.*?)\n/g, '<h4>$1</h4>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" style="color:#38bdf8;text-decoration:underline;">$1</a>')
      .replace(/• (.*?)\n/g, '<li>$1</li>')
      .replace(/\n\n/g, '<br><br>');
  }
});
