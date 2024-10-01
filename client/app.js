// client/app.js
const loginForm = document.getElementById('login-form');
const loginDiv = document.getElementById('login');
const chatDiv = document.getElementById('chat');
const chatForm = document.getElementById('chat-form');
const chatInput = document.getElementById('chat-input');
const messagesDiv = document.getElementById('messages');
const usersUl = document.getElementById('users');
const typingDiv = document.getElementById('typing');

let socket;
let typingTimeout;
let token;

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('name-input').value;
    const room = document.getElementById('room-input').value;
    
    try {
        // שליחת בקשת התחברות לשרת
        const response = await fetch('http://localhost:3000/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ name, room }),
        });

        if (!response.ok) {
            throw new Error('התחברות נכשלה');
        }

        const data = await response.json();
        token = data.accessToken;
        console.log('Token received:', token); // הדפסת הטוקן לקונסול

        // התחברות לשרת Socket.IO עם הטוקן
        socket = io('http://localhost:3000', {
            auth: {
                token: token
            }
        });

        loginDiv.style.display = 'none';
        chatDiv.style.display = 'flex';

        setupChatListeners();
    } catch (error) {
        console.error('שגיאה בהתחברות:', error);
        alert('התחברות נכשלה. אנא נסה שנית.');
    }
});

function setupChatListeners() {
    chatForm.addEventListener('submit', (e) => {
        e.preventDefault();
        if (chatInput.value) {
            socket.emit('sendMessage', chatInput.value);
            chatInput.value = '';
        }
    });

    chatInput.addEventListener('input', () => {
        socket.emit('typing', true);
        clearTimeout(typingTimeout);
        typingTimeout = setTimeout(() => socket.emit('typing', false), 1000);
    });

    socket.on('message', (message) => {
        const messageElement = document.createElement('div');
        messageElement.classList.add('message');
        if (message.user === 'מערכת') {
            messageElement.classList.add('system');
        }
        messageElement.textContent = `${message.user}: ${message.text}`;
        messagesDiv.appendChild(messageElement);
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
    });

    socket.on('roomData', ({ users }) => {
        usersUl.innerHTML = '';
        users.forEach(user => {
            const li = document.createElement('li');
            li.textContent = user.name;
            usersUl.appendChild(li);
        });
    });

    socket.on('typing', ({ user, isTyping }) => {
        if (isTyping) {
            typingDiv.textContent = `${user} מקליד...`;
        } else {
            typingDiv.textContent = '';
        }
    });
}