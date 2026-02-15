        // ===== ПРОЕКТЫ И НЕДЕЛИ =====
        let projects = [];
        let currentProjectId = null;
        let currentWeek = 1;
        let totalWeeks = 4;

        function loadProjects() {
            const saved = localStorage.getItem('instaGeneratorProjects');
            if (saved) {
                projects = JSON.parse(saved);
            }
            
            // Миграция старых данных
            const oldState = localStorage.getItem('instaGeneratorState');
            if (oldState && projects.length === 0) {
                const oldData = JSON.parse(oldState);
                projects.push({
                    id: Date.now(),
                    name: 'Мой проект',
                    data: oldData
                });
                localStorage.removeItem('instaGeneratorState');
                saveProjects();
            }
            
            // Если нет проектов — создаём первый
            if (projects.length === 0) {
                projects.push({
                    id: Date.now(),
                    name: 'Новый проект',
                    data: null
                });
            }
            
            // Загружаем последний активный проект
            const lastProjectId = localStorage.getItem('instaGeneratorCurrentProject');
            if (lastProjectId && projects.find(p => p.id == lastProjectId)) {
                currentProjectId = parseInt(lastProjectId);
            } else {
                currentProjectId = projects[0].id;
            }
            
            renderProjectsList();
            updateProjectName();
        }

        function saveProjects() {
            localStorage.setItem('instaGeneratorProjects', JSON.stringify(projects));
            localStorage.setItem('instaGeneratorCurrentProject', currentProjectId);
        }

        function toggleProjectDropdown() {
            document.getElementById('projectDropdown').classList.toggle('open');
        }

        function renderProjectsList() {
            const list = document.getElementById('projectsList');
            list.innerHTML = '';
            
            projects.forEach(project => {
                const item = document.createElement('div');
                item.className = 'project-item' + (project.id === currentProjectId ? ' active' : '');
                item.innerHTML = `
                    <span class="icon">📁</span>
                    <span class="name">${project.name}</span>
                    ${projects.length > 1 ? '<span class="delete" onclick="event.stopPropagation(); deleteProject(' + project.id + ')">✕</span>' : ''}
                `;
                item.onclick = () => switchProject(project.id);
                list.appendChild(item);
            });
        }

        function updateProjectName() {
            const project = projects.find(p => p.id === currentProjectId);
            if (project) {
                document.getElementById('currentProjectName').textContent = project.name;
                // Загружаем настройки недель проекта
                totalWeeks = project.totalWeeks || 3;
                currentWeek = project.currentWeek || 1;
                renderWeeksNav();
            }
        }

        const weekNames = ['Первая', 'Вторая', 'Третья', 'Четвёртая', 'Пятая', 'Шестая', 'Седьмая', 'Восьмая', 'Девятая', 'Десятая'];

        function getWeekName(num) {
            if (num <= weekNames.length) {
                return weekNames[num - 1] + ' неделя';
            }
            return 'Неделя ' + num;
        }

        function toggleWeekDropdown() {
            document.getElementById('weekDropdown').classList.toggle('open');
        }

        function renderWeeksNav() {
            const list = document.getElementById('weeksList');
            list.innerHTML = '';
            
            for (let i = 1; i <= totalWeeks; i++) {
                const item = document.createElement('div');
                item.className = 'week-item' + (i === currentWeek ? ' active' : '');
                item.innerHTML = `
                    <span class="icon">📅</span>
                    <span>${getWeekName(i)}</span>
                `;
                item.onclick = () => {
                    switchWeek(i);
                    toggleWeekDropdown();
                };
                list.appendChild(item);
            }
            
            // Обновляем название текущей недели
            document.getElementById('currentWeekName').textContent = getWeekName(currentWeek);
        }

        function switchWeek(weekNum) {
            // Сохраняем текущую неделю
            saveCurrentWeekData();
            
            currentWeek = weekNum;
            
            // Сохраняем текущую неделю в проект
            const project = projects.find(p => p.id === currentProjectId);
            if (project) {
                project.currentWeek = currentWeek;
                saveProjects();
            }
            
            // Загружаем данные новой недели
            loadCurrentWeekData();
            renderWeeksNav();
        }

        function addWeek() {
            // Сохраняем текущую неделю
            saveCurrentWeekData();
            
            totalWeeks++;
            currentWeek = totalWeeks;
            
            // Переносим утверждённые темы с предыдущей недели
            const project = projects.find(p => p.id === currentProjectId);
            if (project) {
                project.totalWeeks = totalWeeks;
                project.currentWeek = currentWeek;
                
                // Копируем утверждённые темы
                const prevWeekKey = 'week_' + (totalWeeks - 1);
                const newWeekKey = 'week_' + totalWeeks;
                
                if (project.weeks && project.weeks[prevWeekKey]) {
                    const prevData = project.weeks[prevWeekKey];
                    if (prevData.topics) {
                        const acceptedTopics = prevData.topics.filter(t => t.accepted);
                        project.weeks[newWeekKey] = {
                            ...getCurrentState(),
                            topics: acceptedTopics
                        };
                    }
                }
                
                saveProjects();
            }
            
            loadCurrentWeekData();
            renderWeeksNav();
            toggleWeekDropdown();
        }

        function saveCurrentWeekData() {
            const project = projects.find(p => p.id === currentProjectId);
            if (project) {
                if (!project.weeks) project.weeks = {};
                const weekKey = 'week_' + currentWeek;
                project.weeks[weekKey] = getCurrentState();
                saveProjects();
            }
        }

        function loadCurrentWeekData() {
            const project = projects.find(p => p.id === currentProjectId);
            if (project && project.weeks) {
                const weekKey = 'week_' + currentWeek;
                
                // Собираем утверждённые темы со всех предыдущих недель
                let inheritedTopics = [];
                for (let i = 1; i < currentWeek; i++) {
                    const prevKey = 'week_' + i;
                    if (project.weeks[prevKey] && project.weeks[prevKey].topics) {
                        const acceptedFromWeek = project.weeks[prevKey].topics.filter(t => t.accepted);
                        acceptedFromWeek.forEach(topic => {
                            // Проверяем, нет ли уже такой темы
                            const exists = inheritedTopics.some(t => t.ru === topic.ru);
                            if (!exists) {
                                inheritedTopics.push({...topic, inherited: true});
                            }
                        });
                    }
                }
                
                if (project.weeks[weekKey]) {
                    const weekData = project.weeks[weekKey];
                    
                    // Добавляем унаследованные темы, которых ещё нет
                    if (weekData.topics) {
                        inheritedTopics.forEach(inhTopic => {
                            const exists = weekData.topics.some(t => t.ru === inhTopic.ru);
                            if (!exists) {
                                weekData.topics.unshift(inhTopic);
                            }
                        });
                    } else {
                        weekData.topics = inheritedTopics;
                    }
                    
                    restoreState(weekData);
                    return;
                } else if (inheritedTopics.length > 0) {
                    // Новая неделя — загружаем только унаследованные темы
                    const newWeekData = {
                        context: '',
                        mainLang: 'ru',
                        aiModel: 'claude-sonnet',
                        topicIndex: 0,
                        attachments: [],
                        topics: inheritedTopics
                    };
                    restoreState(newWeekData);
                    return;
                }
            }
            clearUI();
        }

        function switchProject(projectId) {
            // Сохраняем текущую неделю текущего проекта
            saveCurrentWeekData();
            
            // Переключаемся
            currentProjectId = projectId;
            saveProjects();
            
            // Загружаем данные нового проекта
            const project = projects.find(p => p.id === currentProjectId);
            if (project) {
                totalWeeks = project.totalWeeks || 3;
                currentWeek = project.currentWeek || 1;
            }
            
            loadCurrentWeekData();
            
            renderProjectsList();
            updateProjectName();
            toggleProjectDropdown();
        }

        function createNewProject() {
            const name = prompt('Название проекта:');
            if (name && name.trim()) {
                // Сохраняем текущую неделю
                saveCurrentWeekData();
                
                // Создаём новый
                const newProject = {
                    id: Date.now(),
                    name: name.trim(),
                    totalWeeks: 4,
                    currentWeek: 1,
                    weeks: {}
                };
                projects.push(newProject);
                currentProjectId = newProject.id;
                totalWeeks = 4;
                currentWeek = 1;
                
                saveProjects();
                
                // Очищаем UI для нового проекта
                clearUI();
                
                renderProjectsList();
                updateProjectName();
                
                // Закрываем dropdown проектов если открыт
                document.getElementById('projectDropdown').classList.remove('open');
            }
        }

        function deleteProject(projectId) {
            if (projects.length <= 1) return;
            
            if (confirm('Удалить этот проект?')) {
                projects = projects.filter(p => p.id !== projectId);
                
                // Если удалили текущий — переключаемся на первый
                if (currentProjectId === projectId) {
                    currentProjectId = projects[0].id;
                    loadCurrentProjectData();
                    updateProjectName();
                }
                
                saveProjects();
                renderProjectsList();
            }
        }

        function saveCurrentProjectData() {
            const project = projects.find(p => p.id === currentProjectId);
            if (project) {
                project.data = getCurrentState();
                saveProjects();
            }
        }

        function loadCurrentProjectData() {
            const project = projects.find(p => p.id === currentProjectId);
            if (project && project.data) {
                restoreState(project.data);
            } else {
                clearUI();
            }
        }

        function clearUI() {
            document.getElementById('contextInput').value = '';
            document.getElementById('mainLangSelect').value = 'ru';
            document.getElementById('topicsList').innerHTML = `
                <div class="empty-state">
                    <span>💡</span>
                    Нажмите кнопку выше,<br>чтобы сгенерировать темы
                </div>
            `;
            attachments = [];
            renderAttachments();
            topicIndex = 0;
        }

        // Закрытие dropdown при клике вне
        document.addEventListener('click', function(e) {
            const dropdown = document.getElementById('projectDropdown');
            const btn = document.querySelector('.project-btn');
            if (!dropdown.contains(e.target) && !btn.contains(e.target)) {
                dropdown.classList.remove('open');
            }
            
            const weekDropdown = document.getElementById('weekDropdown');
            const weekBtn = document.querySelector('.week-current-btn');
            if (!weekDropdown.contains(e.target) && !weekBtn.contains(e.target)) {
                weekDropdown.classList.remove('open');
            }
        });

        // ===== СОХРАНЕНИЕ СОСТОЯНИЯ =====
        function getCurrentState() {
            const state = {
                context: document.getElementById('contextInput').value,
                mainLang: document.getElementById('mainLangSelect').value,
                aiModel: document.getElementById('aiModelSelect').value,
                topicIndex: topicIndex,
                attachments: attachments,
                topics: []
            };
            
            document.querySelectorAll('.topic-item').forEach(item => {
                const topicText = item.querySelector('.topic-text');
                const translationText = item.querySelector('.translation-text');
                const translationLang = item.querySelector('.translation-lang');
                state.topics.push({
                    ru: topicText ? topicText.dataset.ru : '',
                    en: topicText ? topicText.dataset.en : '',
                    translation: translationText ? translationText.textContent : '',
                    lang: translationLang ? translationLang.value : 'en',
                    accepted: item.classList.contains('accepted'),
                    maybe: item.classList.contains('maybe')
                });
            });
            
            return state;
        }

        function saveState() {
            saveCurrentWeekData();
        }

        function restoreState(state) {
            document.getElementById('contextInput').value = state.context || '';
            document.getElementById('mainLangSelect').value = state.mainLang || 'ru';
            document.getElementById('aiModelSelect').value = state.aiModel || 'claude-sonnet';
            topicIndex = state.topicIndex || 0;
            
            if (state.attachments) {
                attachments = state.attachments;
                renderAttachments();
            } else {
                attachments = [];
                renderAttachments();
            }
            
            if (state.topics && state.topics.length > 0) {
                const list = document.getElementById('topicsList');
                list.innerHTML = '';
                
                const mainLang = state.mainLang || 'ru';
                
                state.topics.forEach(topic => {
                    const item = document.createElement('div');
                    let itemClass = 'topic-item';
                    if (topic.accepted) itemClass += ' accepted';
                    if (topic.maybe) itemClass += ' maybe';
                    item.className = itemClass;
                    
                    const ruText = topic.ru || '';
                    const enText = topic.en || '';
                    const mainText = mainLang === 'ru' ? ruText : enText;
                    const secondText = mainLang === 'ru' ? enText : ruText;
                    
                    item.innerHTML = `
                        <div class="topic-content">
                            <div class="topic-text" data-ru="${ruText}" data-en="${enText}">${mainText}</div>
                            <div class="topic-translation">
                                <div class="translation-text" data-ru="${ruText}" data-en="${enText}">${secondText}</div>
                                <select class="translation-lang" onchange="changeTranslationLang(this)">
                                    <option value="en" ${topic.lang === 'en' ? 'selected' : ''}>EN</option>
                                    <option value="de" ${topic.lang === 'de' ? 'selected' : ''}>DE</option>
                                    <option value="es" ${topic.lang === 'es' ? 'selected' : ''}>ES</option>
                                    <option value="fr" ${topic.lang === 'fr' ? 'selected' : ''}>FR</option>
                                    <option value="it" ${topic.lang === 'it' ? 'selected' : ''}>IT</option>
                                    <option value="pt" ${topic.lang === 'pt' ? 'selected' : ''}>PT</option>
                                    <option value="zh" ${topic.lang === 'zh' ? 'selected' : ''}>ZH</option>
                                    <option value="ja" ${topic.lang === 'ja' ? 'selected' : ''}>JA</option>
                                </select>
                            </div>
                        </div>
                        <div class="topic-actions">
                            <button class="btn-accept" onclick="acceptTopic(this)" title="Принять">✓</button>
                            <button class="btn-maybe" onclick="maybeTopic(this)" title="Возможно">?</button>
                            <button class="btn-reject" onclick="rejectTopic(this)" title="Удалить">✕</button>
                        </div>
                    `;
                    list.appendChild(item);
                });
            } else {
                document.getElementById('topicsList').innerHTML = `
                    <div class="empty-state">
                        <span>💡</span>
                        Нажмите кнопку выше,<br>чтобы сгенерировать темы
                    </div>
                `;
            }
        }

        // Загружаем при старте
        window.addEventListener('DOMContentLoaded', function() {
            loadProjects();
            loadCurrentWeekData();
        });

        // Все доступные темы для демо (русский + английский)
        const allDemoTopics = [
            { ru: "5 ошибок начинающих фотографов, которые легко исправить", en: "5 beginner photographer mistakes that are easy to fix" },
            { ru: "Как выбрать локацию для семейной съёмки", en: "How to choose a location for a family photoshoot" },
            { ru: "Почему естественный свет — лучший друг фотографа", en: "Why natural light is a photographer's best friend" },
            { ru: "Секреты работы с детьми на фотосессии", en: "Secrets of working with children during a photoshoot" },
            { ru: "Как подготовить клиента к съёмке: чек-лист", en: "How to prepare a client for a shoot: checklist" },
            { ru: "Тренды в семейной фотографии 2025", en: "Family photography trends 2025" },
            { ru: "Как создать уютную атмосферу на съёмке", en: "How to create a cozy atmosphere during a shoot" },
            { ru: "Работа с естественными эмоциями: советы", en: "Working with natural emotions: tips" },
            { ru: "Идеи для весенней фотосессии", en: "Spring photoshoot ideas" },
            { ru: "Почему важна предварительная встреча с клиентом", en: "Why a preliminary meeting with the client is important" },
            { ru: "Как фотографировать большие семьи", en: "How to photograph large families" },
            { ru: "Лучшее время дня для уличной съёмки", en: "Best time of day for outdoor shooting" },
            { ru: "Как работать с застенчивыми детьми", en: "How to work with shy children" },
            { ru: "Создание серии: рассказываем историю в фото", en: "Creating a series: telling a story through photos" },
            { ru: "Гардероб для фотосессии: советы клиентам", en: "Wardrobe for a photoshoot: tips for clients" }
        ];
        
        let topicIndex = 0;

        function generateTopics() {
            const list = document.getElementById('topicsList');
            
            // Убираем empty state если есть
            const emptyState = list.querySelector('.empty-state');
            if (emptyState) emptyState.remove();
            
            // Удаляем все темы БЕЗ галочки и БЕЗ "возможно"
            const allItems = list.querySelectorAll('.topic-item');
            allItems.forEach(item => {
                if (!item.classList.contains('accepted') && !item.classList.contains('maybe')) {
                    item.remove();
                }
            });
            
            // Берём следующие 5 тем
            const newTopics = [];
            for (let i = 0; i < 5; i++) {
                newTopics.push(allDemoTopics[topicIndex % allDemoTopics.length]);
                topicIndex++;
            }
            
            // Добавляем 5 новых тем
            const mainLang = document.getElementById('mainLangSelect').value;
            
            newTopics.forEach((topic, index) => {
                setTimeout(() => {
                    const item = document.createElement('div');
                    item.className = 'topic-item';
                    
                    // Определяем что показывать сверху в зависимости от основного языка
                    const mainText = mainLang === 'ru' ? topic.ru : topic.en;
                    const secondText = mainLang === 'ru' ? topic.en : topic.ru;
                    
                    item.innerHTML = `
                        <div class="topic-content">
                            <div class="topic-text" data-ru="${topic.ru}" data-en="${topic.en}">${mainText}</div>
                            <div class="topic-translation">
                                <div class="translation-text" data-ru="${topic.ru}" data-en="${topic.en}">${secondText}</div>
                                <select class="translation-lang" onchange="changeTranslationLang(this)">
                                    <option value="en">EN</option>
                                    <option value="de">DE</option>
                                    <option value="es">ES</option>
                                    <option value="fr">FR</option>
                                    <option value="it">IT</option>
                                    <option value="pt">PT</option>
                                    <option value="zh">ZH</option>
                                    <option value="ja">JA</option>
                                </select>
                            </div>
                        </div>
                        <div class="topic-actions">
                            <button class="btn-accept" onclick="acceptTopic(this)" title="Принять">✓</button>
                            <button class="btn-maybe" onclick="maybeTopic(this)" title="Возможно">?</button>
                            <button class="btn-reject" onclick="rejectTopic(this)" title="Удалить">✕</button>
                        </div>
                    `;
                    list.appendChild(item);
                    saveState();
                }, index * 150);
            });
        }

        function maybeTopic(btn) {
            const item = btn.closest('.topic-item');
            if (item.classList.contains('maybe')) {
                item.classList.remove('maybe');
            } else {
                item.classList.remove('accepted');
                item.classList.add('maybe');
            }
            saveState();
        }

        function changeTranslationLang(select) {
            // Пока просто показываем что язык выбран
            // В будущем здесь будет реальный перевод через API
            saveState();
        }

        function switchMainLang() {
            const mainLang = document.getElementById('mainLangSelect').value;
            
            document.querySelectorAll('.topic-item').forEach(item => {
                const topicText = item.querySelector('.topic-text');
                const translationText = item.querySelector('.translation-text');
                
                if (topicText && topicText.dataset.ru && topicText.dataset.en) {
                    // Переключаем основной текст
                    if (mainLang === 'ru') {
                        topicText.textContent = topicText.dataset.ru;
                        if (translationText) translationText.textContent = translationText.dataset.en;
                    } else if (mainLang === 'en') {
                        topicText.textContent = topicText.dataset.en;
                        if (translationText) translationText.textContent = translationText.dataset.ru;
                    }
                }
            });
            
            saveState();
        }

        function acceptTopic(btn) {
            const item = btn.closest('.topic-item');
            if (item.classList.contains('accepted')) {
                item.classList.remove('accepted');
            } else {
                item.classList.remove('maybe');
                item.classList.add('accepted');
            }
            saveState();
        }

        function rejectTopic(btn) {
            const item = btn.closest('.topic-item');
            item.style.animation = 'none';
            item.style.opacity = '0';
            item.style.transform = 'translateX(-20px)';
            item.style.transition = 'all 0.3s ease';
            setTimeout(() => {
                item.remove();
                saveState();
            }, 300);
        }

        // Автосохранение при вводе
        document.getElementById('contextInput').addEventListener('input', saveState);

        // ===== ATTACHMENTS =====
        let attachments = [];

        function toggleLinkInput() {
            const wrapper = document.getElementById('linkInputWrapper');
            wrapper.classList.toggle('visible');
            if (wrapper.classList.contains('visible')) {
                document.getElementById('linkInput').focus();
            }
        }

        function addLink() {
            const input = document.getElementById('linkInput');
            const url = input.value.trim();
            if (url) {
                attachments.push({ type: 'link', name: url, url: url });
                renderAttachments();
                input.value = '';
                document.getElementById('linkInputWrapper').classList.remove('visible');
                saveState();
            }
        }

        function addFile(input) {
            if (input.files[0]) {
                const file = input.files[0];
                attachments.push({ type: 'file', name: file.name });
                renderAttachments();
                saveState();
            }
            input.value = '';
        }

        function addImage(input) {
            if (input.files[0]) {
                const file = input.files[0];
                const reader = new FileReader();
                reader.onload = function(e) {
                    attachments.push({ type: 'image', name: file.name, data: e.target.result });
                    renderAttachments();
                    saveState();
                };
                reader.readAsDataURL(file);
            }
            input.value = '';
        }

        function addAudio(input) {
            if (input.files[0]) {
                const file = input.files[0];
                attachments.push({ type: 'audio', name: file.name });
                renderAttachments();
                saveState();
            }
            input.value = '';
        }

        function removeAttachment(index) {
            attachments.splice(index, 1);
            renderAttachments();
            saveState();
        }

        function renderAttachments() {
            const list = document.getElementById('attachmentsList');
            list.innerHTML = '';
            
            attachments.forEach((att, index) => {
                const item = document.createElement('div');
                item.className = 'attachment-item ' + att.type;
                
                if (att.type === 'image' && att.data) {
                    item.innerHTML = `<img src="${att.data}" alt="${att.name}"><span class="remove" onclick="removeAttachment(${index})">✕</span>`;
                } else if (att.type === 'link') {
                    item.innerHTML = `🔗 <a href="${att.url}" target="_blank" style="color:#667eea">${att.name.substring(0,30)}...</a><span class="remove" onclick="removeAttachment(${index})">✕</span>`;
                } else if (att.type === 'audio') {
                    item.innerHTML = `🎵 ${att.name}<span class="remove" onclick="removeAttachment(${index})">✕</span>`;
                } else {
                    item.innerHTML = `📎 ${att.name}<span class="remove" onclick="removeAttachment(${index})">✕</span>`;
                }
                
                list.appendChild(item);
            });
        }

        // Enter для добавления ссылки
        document.getElementById('linkInput').addEventListener('keypress', function(e) {
            if (e.key === 'Enter') addLink();
        });

        // ===== ПЛАТФОРМЫ =====
        const platformInfo = {
            'instagram': { 
                name: 'Instagram', icon: '📷', bg: 'linear-gradient(45deg, #f09433, #dc2743, #bc1888)',
                formats: ['Пост', 'Stories', 'Reels', 'Карусель']
            },
            'pinterest': { 
                name: 'Pinterest', icon: '📌', bg: '#E60023',
                formats: ['Пин', 'Idea Pin', 'Доска']
            },
            'tiktok': { 
                name: 'TikTok', icon: '🎵', bg: '#000',
                formats: ['Видео', 'Stories', 'LIVE']
            },
            'youtube': { 
                name: 'YouTube', icon: '▶️', bg: '#FF0000',
                formats: ['Видео', 'Shorts', 'Community', 'Описание']
            },
            'facebook': { 
                name: 'Facebook', icon: '📘', bg: '#1877F2',
                formats: ['Пост', 'Stories', 'Reels', 'Группа']
            },
            'twitter': { 
                name: 'X / Twitter', icon: '𝕏', bg: '#000',
                formats: ['Твит', 'Тред', 'Цитата']
            },
            'linkedin': { 
                name: 'LinkedIn', icon: '💼', bg: '#0A66C2',
                formats: ['Пост', 'Статья', 'Карусель']
            },
            'telegram': { 
                name: 'Telegram', icon: '✈️', bg: '#26A5E4',
                formats: ['Пост', 'Канал', 'Чат']
            },
            'whatsapp': { 
                name: 'WhatsApp', icon: '💬', bg: '#25D366',
                formats: ['Статус', 'Сообщение', 'Рассылка']
            },
            'snapchat': { 
                name: 'Snapchat', icon: '👻', bg: '#FFFC00',
                formats: ['Snap', 'Story', 'Spotlight']
            },
            'threads': { 
                name: 'Threads', icon: '🧵', bg: '#000',
                formats: ['Пост', 'Ответ']
            },
            'reddit': { 
                name: 'Reddit', icon: '🤖', bg: '#FF4500',
                formats: ['Пост', 'Комментарий']
            },
            'vk': { 
                name: 'ВКонтакте', icon: 'ВК', bg: '#0077FF',
                formats: ['Пост', 'Stories', 'Клипы', 'Статья']
            },
            'ok': { 
                name: 'OK.ru', icon: '🟠', bg: '#EE8208',
                formats: ['Пост', 'Тема', 'Видео']
            },
            'website': { 
                name: 'Сайт', icon: '🌐', bg: 'linear-gradient(135deg, #667eea, #764ba2)',
                formats: ['Главная', 'Лендинг', 'О нас', 'Услуги']
            },
            'blog': { 
                name: 'Блог', icon: '📝', bg: '#FF5722',
                formats: ['Статья', 'Обзор', 'Гайд', 'Новость']
            },
            'email': { 
                name: 'Email', icon: '📧', bg: '#4CAF50',
                formats: ['Рассылка', 'Welcome', 'Промо', 'Дайджест']
            },
            'podcast': { 
                name: 'Подкаст', icon: '🎙️', bg: '#8E44AD',
                formats: ['Эпизод', 'Описание', 'Анонс']
            }
        };

        let activeCards = [];

        function togglePlatformPicker() {
            document.getElementById('platformPicker').classList.toggle('open');
        }

        function loadActiveCards() {
            const saved = localStorage.getItem('instaGeneratorActiveCards');
            if (saved) {
                activeCards = JSON.parse(saved);
                activeCards.forEach(cardData => {
                    createCardElement(cardData.platform, cardData.id, cardData.x, cardData.y, cardData.width, cardData.height, cardData.formats || [], cardData.extracted || []);
                });
            }
            
            // Загружаем format cards
            const formatCardsSaved = localStorage.getItem('instaGeneratorFormatCards');
            if (formatCardsSaved) {
                const formatCards = JSON.parse(formatCardsSaved);
                formatCards.forEach(fc => {
                    createFormatCard(fc.parentId, fc.format, fc.x, fc.y, fc.text || '');
                });
                updateConnections();
            }
        }

        function createFormatCard(parentId, formatName, x, y, text) {
            const panel = document.getElementById('rightPanel');
            
            const formatCard = document.createElement('div');
            formatCard.className = 'format-card';
            formatCard.dataset.parentId = parentId;
            formatCard.dataset.format = formatName;
            formatCard.id = 'format-' + parentId + '-' + formatName.replace(/\s/g, '-');
            formatCard.style.left = x + 'px';
            formatCard.style.top = y + 'px';
            
            // Берём текст из хранилища или из переданного параметра
            const textKey = getFormatTextKey(parentId, formatName);
            const savedData = formatTexts[textKey] || { context: '', text: text || '' };
            const ctx = typeof savedData === 'string' ? '' : (savedData.context || '');
            const txt = typeof savedData === 'string' ? savedData : (savedData.text || '');
            
            formatCard.innerHTML = `
                <button class="return-btn" onclick="returnFormat(this)">✕</button>
                <div class="format-card-title">${formatName}</div>
                <div class="format-section">
                    <div class="format-section-label">📋 Контекст</div>
                    <textarea class="format-card-context" placeholder="Идея, заметки, о чём пост..." oninput="saveFormatText(this)" onblur="saveFormatText(this)">${ctx}</textarea>
                </div>
                <div class="format-section">
                    <div class="format-section-label">✨ Текст</div>
                    <textarea class="format-card-text" placeholder="Сгенерированный текст..." oninput="saveFormatText(this)" onblur="saveFormatText(this)">${txt}</textarea>
                </div>
            `;
            
            panel.appendChild(formatCard);
            
            // Делаем перетаскиваемой (только за заголовок)
            const titleEl = formatCard.querySelector('.format-card-title');
            if (titleEl) {
                titleEl.addEventListener('mousedown', function(e) {
                    draggingFormat = formatCard;
                    const rect = formatCard.getBoundingClientRect();
                    formatOffsetX = e.clientX - rect.left;
                    formatOffsetY = e.clientY - rect.top;
                    e.preventDefault();
                });
            }
        }

        function saveActiveCards() {
            const cards = [];
            document.querySelectorAll('.platform-card').forEach(card => {
                const activeFormats = [];
                card.querySelectorAll('.format-btn.active').forEach(btn => {
                    activeFormats.push(btn.textContent);
                });
                
                const extractedFormats = [];
                card.querySelectorAll('.format-btn.extracted').forEach(btn => {
                    extractedFormats.push(btn.textContent);
                });
                
                cards.push({
                    id: card.id,
                    platform: card.dataset.platform,
                    x: parseInt(card.style.left) || 0,
                    y: parseInt(card.style.top) || 0,
                    width: card.offsetWidth,
                    height: card.offsetHeight,
                    formats: activeFormats,
                    extracted: extractedFormats
                });
            });
            
            // Сохраняем позиции format cards
            const formatCards = [];
            document.querySelectorAll('.format-card').forEach(fc => {
                const textarea = fc.querySelector('.format-card-text');
                formatCards.push({
                    parentId: fc.dataset.parentId,
                    format: fc.dataset.format,
                    x: parseInt(fc.style.left) || 0,
                    y: parseInt(fc.style.top) || 0,
                    text: textarea ? textarea.value : ''
                });
            });
            
            activeCards = cards;
            localStorage.setItem('instaGeneratorActiveCards', JSON.stringify(cards));
            localStorage.setItem('instaGeneratorFormatCards', JSON.stringify(formatCards));
        }

        function addPlatformCard(platform) {
            const id = 'card-' + platform + '-' + Date.now();
            createCardElement(platform, id, 50 + Math.random() * 100, 50 + Math.random() * 100, 300, 220, [], []);
            saveActiveCards();
            togglePlatformPicker();
        }

        function createCardElement(platform, id, x, y, width, height, activeFormats, extractedFormats) {
            const info = platformInfo[platform];
            const panel = document.getElementById('rightPanel');
            
            const card = document.createElement('div');
            card.className = 'platform-card';
            card.id = id;
            card.dataset.platform = platform;
            card.style.left = x + 'px';
            card.style.top = y + 'px';
            if (width) card.style.width = width + 'px';
            if (height) card.style.height = height + 'px';
            
            const formatsHtml = info.formats.map(format => {
                let classes = 'format-btn';
                if (activeFormats && activeFormats.includes(format)) classes += ' active';
                if (extractedFormats && extractedFormats.includes(format)) classes += ' extracted';
                return `<button class="${classes}" onclick="toggleFormat(this)">${format}</button>`;
            }).join('');
            
            card.innerHTML = `
                <button class="delete-card" onclick="deleteCard('${id}')">✕</button>
                <div class="platform-header">
                    <div class="platform-icon" style="background: ${info.bg};">${info.icon}</div>
                    <div class="platform-name">${info.name}</div>
                </div>
                <div class="platform-formats">
                    ${formatsHtml}
                </div>
                <div class="platform-content">
                    ...
                </div>
                <div class="resize-handle"></div>
            `;
            
            panel.appendChild(card);
            initCardDrag(card);
            initCardResize(card);
            initFormatDrag(card);
            
            // Помечаем кнопки у которых есть сохранённый текст
            card.querySelectorAll('.format-btn').forEach(btn => {
                const formatName = btn.textContent.replace(' ✓', '');
                const textKey = getFormatTextKey(id, formatName);
                const data = formatTexts[textKey];
                if (data) {
                    const hasContent = typeof data === 'string' 
                        ? data.trim() 
                        : ((data.context && data.context.trim()) || (data.text && data.text.trim()));
                    if (hasContent) {
                        btn.classList.add('has-text');
                    }
                }
            });
        }

        function initCardResize(card) {
            const handle = card.querySelector('.resize-handle');
            if (!handle) return;
            
            handle.addEventListener('mousedown', function(e) {
                e.stopPropagation();
                resizingCard = card;
                startWidth = card.offsetWidth;
                startHeight = card.offsetHeight;
                startX = e.clientX;
                startY = e.clientY;
                e.preventDefault();
            });
        }

        function deleteCard(id) {
            const card = document.getElementById(id);
            if (card && confirm('Удалить эту карточку?')) {
                card.remove();
                saveActiveCards();
            }
        }

        function toggleFormat(btn) {
            btn.classList.toggle('active');
            saveActiveCards();
        }

        // ===== ВЫТЯГИВАНИЕ ФОРМАТОВ =====
        let extractedFormats = [];
        let draggingFormat = null;
        let formatOffsetX, formatOffsetY;
        
        // Хранилище текстов форматов (сохраняется даже когда карточка свёрнута)
        let formatTexts = {};
        
        function loadFormatTexts() {
            const saved = localStorage.getItem('instaGeneratorFormatTexts');
            if (saved) {
                formatTexts = JSON.parse(saved);
            }
        }
        
        function saveFormatTexts() {
            localStorage.setItem('instaGeneratorFormatTexts', JSON.stringify(formatTexts));
        }
        
        function getFormatTextKey(parentId, formatName) {
            return parentId + '::' + formatName;
        }
        
        function saveFormatText(textarea) {
            const card = textarea.closest('.format-card');
            const parentId = card.dataset.parentId;
            const formatName = card.dataset.format;
            const textKey = getFormatTextKey(parentId, formatName);
            
            const contextArea = card.querySelector('.format-card-context');
            const textArea = card.querySelector('.format-card-text');
            
            formatTexts[textKey] = {
                context: contextArea ? contextArea.value : '',
                text: textArea ? textArea.value : ''
            };
            saveFormatTexts();
        }

        function initFormatDrag(card) {
            card.querySelectorAll('.format-btn').forEach(btn => {
                btn.addEventListener('mousedown', function(e) {
                    if (e.target.closest('.delete-card')) return;
                    
                    const parentCard = btn.closest('.platform-card');
                    const parentId = parentCard.id;
                    const formatName = btn.textContent;
                    
                    // Создаём вытянутую карточку
                    const panel = document.getElementById('rightPanel');
                    const panelRect = panel.getBoundingClientRect();
                    const parentRect = parentCard.getBoundingClientRect();
                    
                    const formatCard = document.createElement('div');
                    formatCard.className = 'format-card';
                    formatCard.dataset.parentId = parentId;
                    formatCard.dataset.format = formatName;
                    formatCard.id = 'format-' + parentId + '-' + formatName.replace(/\s/g, '-');
                    
                    const startX = parentRect.right - panelRect.left + 20;
                    const startY = parentRect.top - panelRect.top + 50;
                    
                    formatCard.style.left = startX + 'px';
                    formatCard.style.top = startY + 'px';
                    
                    const textKey = getFormatTextKey(parentId, formatName);
                    const savedData = formatTexts[textKey] || { context: '', text: '' };
                    const ctx = typeof savedData === 'string' ? '' : (savedData.context || '');
                    const txt = typeof savedData === 'string' ? savedData : (savedData.text || '');
                    
                    formatCard.innerHTML = `
                        <button class="return-btn" onclick="returnFormat(this)">✕</button>
                        <div class="format-card-title">${formatName}</div>
                        <div class="format-section">
                            <div class="format-section-label">📋 Контекст</div>
                            <textarea class="format-card-context" placeholder="Идея, заметки, о чём пост..." oninput="saveFormatText(this)" onblur="saveFormatText(this)">${ctx}</textarea>
                        </div>
                        <div class="format-section">
                            <div class="format-section-label">✨ Текст</div>
                            <textarea class="format-card-text" placeholder="Сгенерированный текст..." oninput="saveFormatText(this)" onblur="saveFormatText(this)">${txt}</textarea>
                        </div>
                    `;
                    
                    panel.appendChild(formatCard);
                    
                    // Делаем перетаскиваемой за заголовок
                    const titleEl = formatCard.querySelector('.format-card-title');
                    if (titleEl) {
                        titleEl.addEventListener('mousedown', function(e) {
                            draggingFormat = formatCard;
                            const rect = formatCard.getBoundingClientRect();
                            formatOffsetX = e.clientX - rect.left;
                            formatOffsetY = e.clientY - rect.top;
                            e.preventDefault();
                        });
                    }
                    
                    // Помечаем кнопку как извлечённую
                    btn.classList.add('extracted');
                    
                    // Начинаем перетаскивание
                    draggingFormat = formatCard;
                    formatOffsetX = 50;
                    formatOffsetY = 15;
                    
                    updateConnections();
                    saveActiveCards();
                    
                    e.preventDefault();
                    e.stopPropagation();
                });
            });
        }

        function returnFormat(btn) {
            const formatCard = btn.closest('.format-card');
            const parentId = formatCard.dataset.parentId;
            const formatName = formatCard.dataset.format;
            
            // Сохраняем текст перед сворачиванием
            const contextArea = formatCard.querySelector('.format-card-context');
            const textArea = formatCard.querySelector('.format-card-text');
            const textKey = getFormatTextKey(parentId, formatName);
            formatTexts[textKey] = {
                context: contextArea ? contextArea.value : '',
                text: textArea ? textArea.value : ''
            };
            saveFormatTexts();
            
            // Возвращаем кнопку
            const parentCard = document.getElementById(parentId);
            if (parentCard) {
                parentCard.querySelectorAll('.format-btn').forEach(b => {
                    const btnName = b.textContent.replace(' ✓', '');
                    if (btnName === formatName) {
                        b.classList.remove('extracted');
                        // Показываем что есть текст
                        const data = formatTexts[textKey];
                        const hasContent = (data.context && data.context.trim()) || (data.text && data.text.trim());
                        if (hasContent) {
                            b.classList.add('has-text');
                        } else {
                            b.classList.remove('has-text');
                        }
                    }
                });
            }
            
            formatCard.remove();
            updateConnections();
            saveActiveCards();
        }

        function updateConnections() {
            const svg = document.getElementById('connectionsSvg');
            svg.innerHTML = '';
            
            document.querySelectorAll('.format-card').forEach(formatCard => {
                const parentId = formatCard.dataset.parentId;
                const parentCard = document.getElementById(parentId);
                
                if (parentCard) {
                    const panel = document.getElementById('rightPanel');
                    const panelRect = panel.getBoundingClientRect();
                    
                    const parentRect = parentCard.getBoundingClientRect();
                    const formatRect = formatCard.getBoundingClientRect();
                    
                    const x1 = parentRect.right - panelRect.left;
                    const y1 = parentRect.top - panelRect.top + parentRect.height / 2;
                    const x2 = formatRect.left - panelRect.left;
                    const y2 = formatRect.top - panelRect.top + formatRect.height / 2;
                    
                    // Кривая Безье
                    const midX = (x1 + x2) / 2;
                    
                    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                    path.setAttribute('d', `M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`);
                    path.setAttribute('class', 'connection-line');
                    svg.appendChild(path);
                }
            });
        }

        // Перетаскивание format cards
        document.addEventListener('mousemove', function(e) {
            if (draggingFormat) {
                const panel = document.getElementById('rightPanel');
                const panelRect = panel.getBoundingClientRect();
                
                let newX = e.clientX - panelRect.left - formatOffsetX;
                let newY = e.clientY - panelRect.top - formatOffsetY;
                
                draggingFormat.style.left = newX + 'px';
                draggingFormat.style.top = newY + 'px';
                
                updateConnections();
            }
        });

        document.addEventListener('mouseup', function() {
            if (draggingFormat) {
                // Проверяем, находится ли карточка над родительской
                const parentId = draggingFormat.dataset.parentId;
                const parentCard = document.getElementById(parentId);
                
                if (parentCard) {
                    const parentRect = parentCard.getBoundingClientRect();
                    const formatRect = draggingFormat.getBoundingClientRect();
                    
                    // Центр format card
                    const formatCenterX = formatRect.left + formatRect.width / 2;
                    const formatCenterY = formatRect.top + formatRect.height / 2;
                    
                    // Проверяем пересечение
                    if (formatCenterX >= parentRect.left && 
                        formatCenterX <= parentRect.right &&
                        formatCenterY >= parentRect.top && 
                        formatCenterY <= parentRect.bottom) {
                        
                        // Сохраняем текст перед сворачиванием
                        const formatName = draggingFormat.dataset.format;
                        const contextArea = draggingFormat.querySelector('.format-card-context');
                        const textArea = draggingFormat.querySelector('.format-card-text');
                        const textKey = getFormatTextKey(parentId, formatName);
                        formatTexts[textKey] = {
                            context: contextArea ? contextArea.value : '',
                            text: textArea ? textArea.value : ''
                        };
                        saveFormatTexts();
                        
                        // Возвращаем формат обратно
                        parentCard.querySelectorAll('.format-btn').forEach(b => {
                            const btnName = b.textContent.replace(' ✓', '');
                            if (btnName === formatName) {
                                b.classList.remove('extracted');
                                // Показываем что есть текст
                                const data = formatTexts[textKey];
                                const hasContent = (data.context && data.context.trim()) || (data.text && data.text.trim());
                                if (hasContent) {
                                    b.classList.add('has-text');
                                } else {
                                    b.classList.remove('has-text');
                                }
                            }
                        });
                        draggingFormat.remove();
                        updateConnections();
                    }
                }
                
                saveActiveCards();
                draggingFormat = null;
            }
        });

        // Инициализация перетаскивания для существующих format cards
        document.querySelectorAll('.format-card').forEach(fc => {
            fc.addEventListener('mousedown', function(e) {
                if (e.target.closest('.return-btn')) return;
                
                draggingFormat = fc;
                const rect = fc.getBoundingClientRect();
                formatOffsetX = e.clientX - rect.left;
                formatOffsetY = e.clientY - rect.top;
                
                e.preventDefault();
            });
        });

        function initCardDrag(card) {
            card.addEventListener('mousedown', function(e) {
                if (e.target.closest('.platform-content') || e.target.closest('.delete-card')) return;
                
                draggedCard = card;
                draggedCard.classList.add('dragging');
                
                const rect = card.getBoundingClientRect();
                offsetX = e.clientX - rect.left;
                offsetY = e.clientY - rect.top;
                
                e.preventDefault();
            });
        }

        // Drag & Resize functionality
        let draggedCard = null;
        let offsetX, offsetY;
        let resizingCard = null;
        let startWidth, startHeight, startX, startY;

        document.addEventListener('mousemove', function(e) {
            // Resize
            if (resizingCard) {
                const newWidth = startWidth + (e.clientX - startX);
                const newHeight = startHeight + (e.clientY - startY);
                
                resizingCard.style.width = Math.max(200, newWidth) + 'px';
                resizingCard.style.height = Math.max(150, newHeight) + 'px';
                return;
            }
            
            if (!draggedCard) return;
            
            const panel = document.getElementById('rightPanel');
            const panelRect = panel.getBoundingClientRect();
            
            let newX = e.clientX - panelRect.left - offsetX;
            let newY = e.clientY - panelRect.top - offsetY;
            
            // Ограничиваем в пределах панели
            newX = Math.max(0, Math.min(newX, panelRect.width - draggedCard.offsetWidth));
            newY = Math.max(0, Math.min(newY, panelRect.height - draggedCard.offsetHeight));
            
            draggedCard.style.left = newX + 'px';
            draggedCard.style.top = newY + 'px';
            
            updateConnections();
        });

        document.addEventListener('mouseup', function() {
            if (draggedCard) {
                draggedCard.classList.remove('dragging');
                saveActiveCards();
                updateConnections();
                draggedCard = null;
            }
            if (resizingCard) {
                saveActiveCards();
                updateConnections();
                resizingCard = null;
            }
        });

        // Закрытие picker при клике вне
        document.addEventListener('click', function(e) {
            const picker = document.getElementById('platformPicker');
            const btn = document.querySelector('.add-platform-btn');
            if (!picker.contains(e.target) && !btn.contains(e.target)) {
                picker.classList.remove('open');
            }
        });

        // Загружаем карточки при старте
        window.addEventListener('DOMContentLoaded', function() {
            loadFormatTexts();
            loadActiveCards();
        });

        // ===== ЭКСПОРТ / ИМПОРТ =====
        function exportData() {
            // Сохраняем текущую неделю перед экспортом
            saveCurrentWeekData();
            
            const data = {
                version: 1,
                exportDate: new Date().toISOString(),
                projects: projects,
                currentProjectId: currentProjectId,
                formatTexts: formatTexts,
                activeCards: JSON.parse(localStorage.getItem('instaGeneratorActiveCards') || '[]'),
                formatCards: JSON.parse(localStorage.getItem('instaGeneratorFormatCards') || '[]')
            };
            
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'content-planner-backup-' + new Date().toISOString().split('T')[0] + '.json';
            a.click();
            URL.revokeObjectURL(url);
            
            alert('✅ Данные экспортированы!');
        }

        function importData(input) {
            const file = input.files[0];
            if (!file) return;
            
            const reader = new FileReader();
            reader.onload = function(e) {
                try {
                    const data = JSON.parse(e.target.result);
                    
                    if (data.projects) {
                        projects = data.projects;
                        localStorage.setItem('instaGeneratorProjects', JSON.stringify(projects));
                    }
                    
                    if (data.currentProjectId) {
                        currentProjectId = data.currentProjectId;
                        localStorage.setItem('instaGeneratorCurrentProject', currentProjectId);
                    }
                    
                    if (data.formatTexts) {
                        formatTexts = data.formatTexts;
                        localStorage.setItem('instaGeneratorFormatTexts', JSON.stringify(formatTexts));
                    }
                    
                    if (data.activeCards) {
                        localStorage.setItem('instaGeneratorActiveCards', JSON.stringify(data.activeCards));
                    }
                    
                    if (data.formatCards) {
                        localStorage.setItem('instaGeneratorFormatCards', JSON.stringify(data.formatCards));
                    }
                    
                    alert('✅ Данные импортированы! Страница перезагрузится.');
                    location.reload();
                    
                } catch (err) {
                    alert('❌ Ошибка при импорте: ' + err.message);
                }
            };
            reader.readAsText(file);
            input.value = '';
        }
