let localStream, screenStream, participantCount = 0;
const peers = new Map();
const userPanels = new Map();
let isRecording = false;
let socketId, sessionId, userId, pollInterval, lastPosition = 0;

async function startMedia() {
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    userId = prompt('Enter your name:') || 'User';
    sessionId = prompt('Enter session_id:') || 'default';
    socketId = `user_${Math.random().toString(36).substr(2, 9)}`;
    const localPanel = createUserPanel(socketId, userId);
    const localVideo = document.createElement('video');
    localVideo.id = `camera_${socketId}`;
    localVideo.autoplay = true;
    localVideo.muted = true;
    localVideo.setAttribute('playsinline', '');
    localPanel.appendChild(localVideo);
    localVideo.srcObject = localStream;
    userPanels.set(socketId, { panel: localPanel, cameraVideo: localVideo, screenVideo: null, isSharing: false, user_id: userId });
    participantCount++;
    updateGridLayout();
    await fetch('/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, session_id: sessionId, socket_id: socketId })
    }).then(res => res.json()).then(data => {
      data.participants.forEach(p => {
        if (!p.socket_id.startsWith('AI_')) {
          createPeerConnection(p.socket_id, p.user_id);
        } else {
          const panel = createUserPanel(p.socket_id, p.user_id);
          userPanels.set(p.socket_id, { panel, cameraVideo: null, screenVideo: null, isSharing: false, user_id: p.user_id });
          participantCount++;
          updateGridLayout();
        }
      });
    });
    startPolling();
  } catch (err) {
    console.error('Error starting media:', err);
  }
}

function updateGridLayout() {
  const totalPanels = participantCount;
  const columns = Math.min(totalPanels, 2);
  const rows = Math.ceil(totalPanels / 2);
  document.getElementById('video-grid').style.gridTemplateColumns = `repeat(${columns}, 1fr)`;
  document.getElementById('video-grid').style.gridTemplateRows = `repeat(${rows}, 1fr)`;
  document.querySelectorAll('.user-panel').forEach(panel => {
    panel.style.width = '100%';
    panel.style.height = '100%';
  });
}

function createUserPanel(socket_id, user_id) {
  const panel = document.createElement('div');
  panel.className = 'user-panel';
  panel.id = `panel_${socket_id}`;
  const nameLabel = document.createElement('div');
  nameLabel.className = 'label';
  nameLabel.textContent = user_id;
  panel.appendChild(nameLabel);
  document.getElementById('video-grid').appendChild(panel);
  if (socket_id.startsWith('AI_')) {
    const aiImage = document.createElement('img');
    aiImage.src = '/Users/deepeshjha/Desktop/video_app/node_video/interviewer.png';
    aiImage.alt = 'AI Interviewer';
    panel.appendChild(aiImage);
  }
  return panel;
}

function createScreenPanel(socket_id, user_id) {
  const screenPanelId = `screen_${socket_id}`;
  if (document.getElementById(screenPanelId)) return null;
  const panel = document.createElement('div');
  panel.className = 'user-panel';
  panel.id = screenPanelId;
  const screenLabel = document.createElement('div');
  screenLabel.className = 'label';
  screenLabel.textContent = `${user_id}'s Screen`;
  panel.appendChild(screenLabel);
  const screenVideo = document.createElement('video');
  screenVideo.id = `screen_video_${socket_id}`;
  screenVideo.autoplay = true;
  screenVideo.setAttribute('playsinline', '');
  panel.appendChild(screenVideo);
  document.getElementById('video-grid').appendChild(panel);
  return { panel, video: screenVideo };
}

function createPeerConnection(socket_id, user_id) {
  const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
  localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
  if (screenStream) {
    screenStream.getTracks().forEach(track => pc.addTrack(track, screenStream));
  }
  pc.ontrack = event => {
    const stream = event.streams[0];
    const track = event.track;
    let panelData = userPanels.get(socket_id);
    if (!panelData) {
      const panel = createUserPanel(socket_id, user_id);
      panelData = { panel, cameraVideo: null, screenVideo: null, isSharing: false, user_id };
      userPanels.set(socket_id, panelData);
      participantCount++;
      updateGridLayout();
    }
    if (track.kind === 'video') {
      if (!panelData.cameraVideo) {
        panelData.cameraVideo = document.createElement('video');
        panelData.cameraVideo.id = `camera_${socket_id}`;
        panelData.cameraVideo.autoplay = true;
        panelData.cameraVideo.setAttribute('playsinline', '');
        panelData.panel.appendChild(panelData.cameraVideo);
        pc.cameraStream = stream;
        panelData.cameraVideo.srcObject = stream;
      } else if (stream !== pc.cameraStream && !panelData.screenVideo) {
        const screenData = createScreenPanel(socket_id, user_id);
        if (screenData) {
          panelData.screenVideo = screenData.video;
          panelData.screenVideo.srcObject = stream;
          participantCount++;
          updateGridLayout();
        }
      }
    }
  };
  pc.onicecandidate = event => {
    if (event.candidate) {
      fetch('/ice_candidate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: socketId, to: socket_id, candidate: event.candidate, session_id: sessionId })
      });
    }
  };
  pc.onnegotiationneeded = async () => {
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await fetch('/offer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: socketId, to: socket_id, offer, session_id: sessionId })
      });
    } catch (err) {
      console.error(`Negotiation error for ${socket_id}:`, err);
    }
  };
  peers.set(socket_id, pc);
  return pc;
}

function startPolling() {
  pollInterval = setInterval(async () => {
    const res = await fetch('/poll', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ socket_id: socketId, session_id: sessionId, last_position: lastPosition })
    });
    const data = await res.json();
    lastPosition = data.new_position;
    data.messages.forEach(msg => {
      if (msg.type === 'user_joined') {
        if (!msg.socket_id.startsWith('AI_')) {
          createPeerConnection(msg.socket_id, msg.user_id);
        } else {
          const panel = createUserPanel(msg.socket_id, msg.user_id);
          userPanels.set(msg.socket_id, { panel, cameraVideo: null, screenVideo: null, isSharing: false, user_id: msg.user_id });
          participantCount++;
          updateGridLayout();
        }
      } else if (msg.type === 'offer') {
        handleOffer(msg.from, msg.offer);
      } else if (msg.type === 'answer') {
        handleAnswer(msg.from, msg.answer);
      } else if (msg.type === 'ice_candidate') {
        handleIceCandidate(msg.from, msg.candidate);
      } else if (msg.type === 'screen_sharing') {
        handleScreenSharing(msg.socket_id, msg.is_sharing, msg.user_id);
      } else if (msg.type === 'chat_message') {
        const msgDiv = document.createElement('div');
        msgDiv.className = 'chat-message';
        msgDiv.innerHTML = `<strong>${msg.user_id}</strong> (${msg.timestamp}): ${msg.message}`;
        document.getElementById('chat-messages').appendChild(msgDiv);
        document.getElementById('chat-messages').scrollTop = document.getElementById('chat-messages').scrollHeight;
      } else if (msg.type === 'audio_response') {
        if (msg.error) {
          console.error(`Audio response error: ${msg.error}`);
          alert(`Error: ${msg.error}`);
        } else {
          const transcriptionDiv = document.createElement('div');
          transcriptionDiv.className = 'chat-message';
          transcriptionDiv.innerHTML = `<strong>You</strong>: ${msg.transcription}`;
          document.getElementById('chat-messages').appendChild(transcriptionDiv);
          const responseDiv = document.createElement('div');
          responseDiv.className = 'chat-message';
          responseDiv.innerHTML = `<strong>AI Interviewer</strong>: ${msg.response_text}`;
          document.getElementById('chat-messages').appendChild(responseDiv);
          document.getElementById('chat-messages').scrollTop = document.getElementById('chat-messages').scrollHeight;
          const audioElement = new Audio(`data:audio/wav;base64,${msg.audio}`);
          audioElement.play().catch(err => console.error('Audio playback error:', err));
        }
      } else if (msg.type === 'user_left') {
        handleUserLeft(msg.socket_id);
      }
    });
  }, 1000);
}

async function handleOffer(from, offer) {
  const pc = createPeerConnection(from, userPanels.get(from)?.user_id || `User_${from}`);
  await pc.setRemoteDescription(new RTCSessionDescription(offer));
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  await fetch('/answer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: socketId, to: from, answer, session_id: sessionId })
  });
}

async function handleAnswer(from, answer) {
  const pc = peers.get(from);
  if (pc) {
    await pc.setRemoteDescription(new RTCSessionDescription(answer));
  }
}

async function handleIceCandidate(from, candidate) {
  const pc = peers.get(from);
  if (pc) {
    await pc.addIceCandidate(new RTCIceCandidate(candidate));
  }
}

function handleScreenSharing(socket_id, isSharing, user_id) {
  const panelData = userPanels.get(socket_id);
  if (socket_id === socketId) {
    if (isSharing && !screenStream) {
      shareScreen(user_id);
    } else if (!isSharing && screenStream) {
      stopScreenShare();
    }
  } else if (panelData && !socket_id.startsWith('AI_')) {
    panelData.isSharing = isSharing;
    if (isSharing && !panelData.screenVideo) {
      const pc = peers.get(socket_id);
      if (pc) {
        const screenData = createScreenPanel(socket_id, panelData.user_id);
        if (screenData) {
          panelData.screenVideo = screenData.video;
          pc.getReceivers().forEach(receiver => {
            if (receiver.track.kind === 'video' && (!pc.cameraStream || receiver.track !== pc.cameraStream.getVideoTracks()[0])) {
              panelData.screenVideo.srcObject = new MediaStream([receiver.track]);
              panelData.screenVideo.play().catch(err => console.error(`Play error for screen ${socket_id}:`, err));
            }
          });
          participantCount++;
          updateGridLayout();
        }
      }
    } else if (!isSharing && panelData.screenVideo) {
      panelData.screenVideo.remove();
      panelData.screenVideo = null;
      const screenPanel = document.getElementById(`screen_${socket_id}`);
      if (screenPanel) screenPanel.remove();
      participantCount--;
      updateGridLayout();
    }
  }
}

function handleUserLeft(socket_id) {
  const pc = peers.get(socket_id);
  if (pc) {
    pc.close();
    peers.delete(socket_id);
  }
  const panelData = userPanels.get(socket_id);
  if (panelData) {
    panelData.panel.remove();
    if (panelData.screenVideo) {
      const screenPanel = document.getElementById(`screen_${socket_id}`);
      if (screenPanel) screenPanel.remove();
      participantCount--;
    }
    userPanels.delete(socket_id);
    participantCount--;
    updateGridLayout();
  }
}

function toggleVideo() {
  const enabled = localStream.getVideoTracks()[0].enabled;
  localStream.getVideoTracks()[0].enabled = !enabled;
}

function toggleAudio() {
  const enabled = localStream.getAudioTracks()[0].enabled;
  localStream.getAudioTracks()[0].enabled = !enabled;
}

async function shareScreen() {
  try {
    screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
    const screenData = createScreenPanel(socketId, userId);
    if (screenData) {
      screenData.video.srcObject = screenStream;
      screenData.video.play().catch(err => console.error('Local screen play error:', err));
    }
    participantCount++;
    updateGridLayout();
    screenStream.getVideoTracks()[0].onended = stopScreenShare;
    peers.forEach((pc, peerId) => {
      screenStream.getTracks().forEach(track => pc.addTrack(track, screenStream));
    });
    peers.forEach(async (pc, peerId) => {
      if (pc.signalingState !== 'stable') return;
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await fetch('/offer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: socketId, to: peerId, offer, session_id: sessionId })
      });
    });
    await fetch('/screen_sharing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ socket_id: socketId, is_sharing: true, user_id: userId, session_id: sessionId })
    });
  } catch (err) {
    console.error('Error sharing screen:', err);
  }
}

function stopScreenShare() {
  if (screenStream) {
    screenStream.getTracks().forEach(track => track.stop());
    screenStream = null;
    const screenPanel = document.getElementById(`screen_${socketId}`);
    if (screenPanel) screenPanel.remove();
    peers.forEach((pc, peerId) => {
      pc.getSenders().forEach(sender => {
        if (sender.track && sender.track.kind === 'video' && !localStream.getVideoTracks().includes(sender.track)) {
          pc.removeTrack(sender);
        }
      });
    });
    peers.forEach(async (pc, peerId) => {
      if (pc.signalingState !== 'stable') return;
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await fetch('/offer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: socketId, to: peerId, offer, session_id: sessionId })
      });
    });
    participantCount--;
    updateGridLayout();
    fetch('/screen_sharing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ socket_id: socketId, is_sharing: false, user_id: userId, session_id: sessionId })
    });
  }
}

function sendMessage() {
  const message = document.getElementById('chat-message').value.trim();
  if (message) {
    fetch('/chat_message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, message, session_id: sessionId })
    });
    document.getElementById('chat-message').value = '';
  }
}

function toggleChat() {
  const chatPanel = document.getElementById('chat-panel');
  chatPanel.classList.toggle('hidden');
  const videoGrid = document.getElementById('video-grid');
  videoGrid.style.flex = chatPanel.classList.contains('hidden') ? '1' : '3';
}

function toggleAudioRecording() {
  if (!isRecording) {
    fetch('/start_recording', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ socket_id: socketId, session_id: sessionId })
    }).then(res => res.json()).then(data => {
      if (data.status === 'recording started') {
        isRecording = true;
      } else {
        alert(`Error: ${data.error}`);
      }
    });
  } else {
    fetch('/stop_recording', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ socket_id: socketId, session_id: sessionId })
    }).then(res => res.json()).then(data => {
      isRecording = false;
    });
  }
}

function leaveCall() {
  localStream.getTracks().forEach(track => track.stop());
  if (screenStream) screenStream.getTracks().forEach(track => track.stop());
  peers.forEach(pc => pc.close());
  peers.clear();
  userPanels.forEach(data => data.panel.remove());
  const screenPanel = document.getElementById(`screen_${socketId}`);
  if (screenPanel) screenPanel.remove();
  userPanels.clear();
  clearInterval(pollInterval);
  fetch('/leave', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ socket_id: socketId, session_id: sessionId })
  }).then(() => {
    window.location.reload();
  });
}

window.onload = startMedia;