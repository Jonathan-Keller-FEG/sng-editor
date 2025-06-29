// Erweiterter JavaScript-Code – Drag-and-Drop zum Hinzufügen zur Reihenfolge und Umordnen innerhalb der Reihenfolge mit automatischer Zeichensatz-Erkennung

// --- Datei von URL laden, wenn fileUrl in URL vorhanden ---
window.addEventListener('DOMContentLoaded', () => {
  const urlParams = new URLSearchParams(window.location.search);
  const fileUrlEncoded = urlParams.get('fileUrl');
  const accessToken = urlParams.get('accessToken');

  if (fileUrlEncoded) {
    const fileUrl = decodeURIComponent(fileUrlEncoded);

    // Datei vom OneDrive URL laden mit AccessToken im Header (falls vorhanden)
    fetch(fileUrl, {
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {}
    })
      .then(res => {
        if (!res.ok) throw new Error('Datei konnte nicht geladen werden');
        return res.text();
      })
      .then(text => {
        parseSNG(text);
      })
      .catch(err => {
        alert('Fehler beim Laden der Datei: ' + err.message);
      });
  }
});

let allSlides = [];
let verseOrder = [];
let isTitledFormat = false;

function parseSNG(text) {
  const lines = text.split(/\r?\n/);
  const meta = {};
  allSlides = [];
  isTitledFormat = false;

  const titleRegex = /^(Vers(\s*\d*)?|Chorus(\s*\d*)?|Pre[- ]?Chorus(\s*\d*)?|Bridge|Ending|Eingangsspiel|Blank)$/i;
  for (let i = 0; i < lines.length; i++) {
    if (titleRegex.test(lines[i].trim())) {
      isTitledFormat = true;
      break;
    }
  }

  let currentSlide = null;
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith('#')) {
      const [key, ...rest] = line.substring(1).split('=');
      meta[key.trim()] = rest.join('=').trim();
      i++;
      continue;
    }

    if (line.startsWith('---')) {
      if (isTitledFormat) {
        const nextLine = lines[i + 1] || '';
        if (titleRegex.test(nextLine.trim())) {
          if (currentSlide) allSlides.push(currentSlide);
          currentSlide = { title: nextLine.trim(), content: [] };
          i += 2;
          continue;
        } else {
          currentSlide?.content.push('---');
          i++;
          continue;
        }
      } else {
        if (currentSlide) allSlides.push(currentSlide);
        currentSlide = { title: '', content: [] };
        i++;
        continue;
      }
    }

    if (!currentSlide) {
      currentSlide = { title: '', content: [] };
    }

    if (!isTitledFormat && currentSlide.content.length === 0 && line.trim() !== '') {
      currentSlide.title = line.trim();
    }

    currentSlide.content.push(line);
    i++;
  }

  if (currentSlide) allSlides.push(currentSlide);

  for (let input of document.querySelectorAll('#attributes input')) {
    input.value = meta[input.id] || '';
  }

  renderSlides();
  renderOrderFromVerseOrder(meta['VerseOrder']);
}

function renderSlides() {
  const slideContainer = document.getElementById('slides');
  slideContainer.innerHTML = '';
  allSlides.forEach((s, i) => {
    const div = document.createElement('div');
    div.className = 'slide';
    div.draggable = true;
    div.dataset.index = i;
    div.innerHTML = `
      <input type="text" value="${s.title}" data-title-index="${i}" class="titleInput"/><br />
      <textarea data-index="${i}">${s.content.join('\n')}</textarea><br />
    `;
    div.addEventListener('dragstart', e => {
      e.dataTransfer.setData('text/plain', i);
    });
    slideContainer.appendChild(div);
  });
  renderOrderList();
}

function renderOrderFromVerseOrder(orderStr) {
  verseOrder = [];
  if (!orderStr || !isTitledFormat) return;
  const tokens = orderStr.split(',').map(s => s.trim()).filter(Boolean);
  tokens.forEach(label => {
    allSlides.forEach((slide, index) => {
      if (slide.title.trim() === label.trim()) {
        verseOrder.push(index);
      }
    });
  });
  renderOrderList();
}

function renderOrderList() {
  const orderContainer = document.getElementById('order');
  orderContainer.innerHTML = '';
  verseOrder.forEach((index, idx) => {
    const div = document.createElement('div');
    div.className = 'slide';
    div.draggable = true;
    div.innerText = allSlides[index].title || '(ohne Titel)';
    div.dataset.index = index;

    const removeBtn = document.createElement('button');
    removeBtn.textContent = 'Entfernen';
    removeBtn.onclick = () => {
      verseOrder.splice(idx, 1);
      renderOrderList();
    };

    div.appendChild(document.createElement('br'));
    div.appendChild(removeBtn);
    div.addEventListener('dragstart', e => {
      e.dataTransfer.setData('order-drag', idx);
    });
    orderContainer.appendChild(div);
  });
}

const order = document.getElementById('order');
order.addEventListener('dragover', e => e.preventDefault());
order.addEventListener('drop', e => {
  e.preventDefault();
  const orderSlides = Array.from(order.querySelectorAll('.slide'));
  const targetSlide = e.target.closest('.slide');
  const toIndex = targetSlide ? orderSlides.indexOf(targetSlide) : -1;

  const fromIndex = e.dataTransfer.getData('order-drag');
  if (fromIndex !== '') {
    const moved = verseOrder.splice(fromIndex, 1)[0];
    if (toIndex >= 0) {
      verseOrder.splice(toIndex, 0, moved);
    } else {
      verseOrder.push(moved);
    }
    renderOrderList();
    return;
  }

  const slideIndex = parseInt(e.dataTransfer.getData('text/plain'));
  if (!isNaN(slideIndex) && !verseOrder.includes(slideIndex)) {
    if (toIndex >= 0) {
      verseOrder.splice(toIndex, 0, slideIndex);
    } else {
      verseOrder.push(slideIndex);
    }
    renderOrderList();
  }
});

document.addEventListener('input', (e) => {
  if (e.target.classList.contains('titleInput')) {
    const i = e.target.dataset.titleIndex;
    if (allSlides[i]) {
      allSlides[i].title = e.target.value;
      renderOrderList();
    }
  }
});

document.getElementById('addSlide').addEventListener('click', () => {
  allSlides.push({ title: 'Neue Folie', content: [''] });
  renderSlides();
});

// --- Speichern via PUT an fileUrl ---
document.getElementById('saveBtn').addEventListener('click', () => {
  const urlParams = new URLSearchParams(window.location.search);
  const fileUrlEncoded = urlParams.get('fileUrl');
  const accessToken = urlParams.get('accessToken');

  if (!fileUrlEncoded) {
    alert('Keine Datei-URL zum Speichern gefunden!');
    return;
  }

  let lines = [];
  document.querySelectorAll('#attributes input').forEach(input => {
    if (input.value.trim() !== '') {
      lines.push(`#${input.id}=${input.value.trim()}`);
    }
  });

  if (isTitledFormat && verseOrder.length > 0) {
    const verseLabels = verseOrder.map(i => allSlides[i].title.trim()).filter(Boolean);
    lines.push(`#VerseOrder=${verseLabels.join(', ')}`);
  }

  allSlides.forEach((slide) => {
    lines.push('---');
    if (slide.title && !slide.content[0].startsWith(slide.title)) lines.push(slide.title);
    lines = lines.concat(slide.content);
  });

  const text = lines.join('\n');

  // PUT Request an fileUrl
  const fileUrl = decodeURIComponent(fileUrlEncoded);

  fetch(fileUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {})
    },
    body: text
  })
    .then(res => {
      if (!res.ok) throw new Error('Datei konnte nicht gespeichert werden');
      alert('Datei erfolgreich gespeichert!');
    })
    .catch(err => {
      alert('Fehler beim Speichern der Datei: ' + err.message);
    });
});
