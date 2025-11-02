const socket = io();
let userId, mode, avatar, partnerId;
let pc;

const setupDiv = document.getElementById('setup');
const chatDiv = document.getElementById('chat');
const partnerInfo = document.getElementById('partnerInfo');
const nextBtn = document.getElementById('nextBtn');
const enableVideoBtn = document.getElementById('enableVideo');
const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');

// Проверка LocalStorage
let storedName = localStorage.getItem('nickname');
let storedAvatar = localStorage.getItem('avatar');

if (storedName) {
  userId = storedName;
  avatar = storedAvatar;
  setupDiv.style.display = 'none';
  chatDiv.style.display = 'block';
  findPartner();
}

document.getElementById('joinBtn').onclick = async () => {
  userId = document.getElementById('userId').value;
  avatar = document.getElementById('avatar').value;
  mode = document.getElementById('mode').value;

  if (!userId) {
    alert("Введите имя");
    return;
  }

  localStorage.setItem('nickname', userId);
  localStorage.setItem('avatar', avatar);

  socket.emit('join', { userId, mode, avatar });
  setupDiv.style.display = 'none';
  chatDiv.style.display = 'block';
  findPartner();
};

function findPartner() {
  socket.emit('findPartner', userId);
}

socket.on('partnerFound', async ({ partnerId: pid, avatar: partnerAvatar }) => {
  partnerId = pid;
  partnerInfo.innerHTML = `Партнёр: ${pid} <img src="${partnerAvatar}" width="50"/>`;

  if (mode === 'text') {
    document.getElementById('textChat').style.display = 'block';
  } else {
    document.getElementById('audioVideo').style.display = 'block';
    await initMedia();
    if (mode === 'video') enableVideoBtn.style.display = 'block';
  }
});

socket.on('noPartner', () => {
  partnerInfo.innerText = 'Партнёр не найден, пробуем снова...';
  setTimeout(findPartner, 2000);
});

nextBtn.onclick = () => {
  partnerInfo.innerText = 'Ищем нового партнёра...';
  if (pc) pc.close();
  pc = null;
  localVideo.srcObject = null;
  remoteVideo.srcObject = null;
  findPartner();
};

async function initMedia() {
  pc = createPeerConnection();
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
  stream.getTracks().forEach(track => pc.addTrack(track, stream));
  localVideo.srcObject = stream;

  if (partnerId) {
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    socket.emit('offer', { sdp: offer, partnerId });
  }
}

enableVideoBtn.onclick = async () => {
  const stream = await navigator.mediaDevices.getUserMedia({ video: true });
  stream.getVideoTracks().forEach(track => {
    const sender = pc.getSenders().find(s => s.track.kind === 'video');
    if (sender) sender.replaceTrack(track);
    else pc.addTrack(track, stream);
  });
  localVideo.srcObject = stream;
};

function createPeerConnection() {
  const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
  pc.ontrack = e => remoteVideo.srcObject = e.streams[0];
  pc.onicecandidate = e => {
    if (e.candidate && partnerId) {
      socket.emit('ice-candidate', { candidate: e.candidate, partnerId });
    }
  };
  return pc;
}
