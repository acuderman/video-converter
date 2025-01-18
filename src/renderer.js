const { ipcRenderer } = require('electron');

const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const progress = document.getElementById('progress');
const progressBar = document.getElementById('progressBar');
const status = document.getElementById('status');

dropZone.addEventListener('click', () => {
    fileInput.click();
});

dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
});

dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
    handleFiles(e.dataTransfer.files);
});

fileInput.addEventListener('change', (e) => {
    handleFiles(e.target.files);
});

let processingQueue = [];
let isProcessing = false;
let outputDirectory = null;

const defaultSettings = {
    scale: 720,
    crf: 20,
    preset: 'slow',
    videoBitrate: 3000,
    audioBitrate: 128,
    bufferSize: 6000,
    suffix: "_c"
};

let currentSettings = { ...defaultSettings };

async function selectOutputDirectory() {
    const { dialog } = require('@electron/remote');
    const result = await dialog.showOpenDialog({
        title: 'Choose Output Folder',
        properties: ['openDirectory']
    });

    if (!result.canceled && result.filePaths.length > 0) {
        outputDirectory = result.filePaths[0];
        updateOutputFolderDisplay();
        return true;
    }
    return false;
}

async function processNextInQueue() {
    if (processingQueue.length === 0 || isProcessing) {
        return;
    }

    if (!outputDirectory) {
        const selected = await selectOutputDirectory();
        if (!selected) {
            status.textContent = 'Processing cancelled - no output folder selected';
            processingQueue = [];
            updateQueueDisplay();
            return;
        }
    }

    isProcessing = true;
    const nextFile = processingQueue[0];

    status.textContent = `Processing ${nextFile.name} (${processingQueue.indexOf(nextFile) + 1}/${processingQueue.length})`;
    progress.style.display = 'block';

    const path = require('path');
    const outputPath = path.join(outputDirectory, nextFile.name.replace(/\.[^/.]+$/, "") + currentSettings.suffix + ".mp4");

    if (nextFile.path) {
        ipcRenderer.send('process-video', {
            inputPath: nextFile.path,
            outputPath: outputPath,
            settings: currentSettings
        });
    } else {
        const tempPath = path.join(require('os').tmpdir(), nextFile.name);
        const reader = new FileReader();
        reader.onload = function(e) {
            require('fs').writeFileSync(tempPath, Buffer.from(e.target.result));
            ipcRenderer.send('process-video', {
                inputPath: tempPath,
                outputPath: outputPath,
                settings: currentSettings
            });
        };
        reader.readAsArrayBuffer(nextFile);
    }
}

function addToQueue(files) {
    Array.from(files).forEach(file => {
        processingQueue.push(file);
        updateQueueDisplay();
    });

    processNextInQueue();
}

function updateQueueDisplay() {
    const queueStatus = document.getElementById('queueStatus');
    if (processingQueue.length > 0) {
        queueStatus.textContent = `Queue: ${processingQueue.length} file(s) remaining`;
        if (outputDirectory) {
            queueStatus.textContent += ` | Output folder: ${outputDirectory}`;
        }
    } else {
        queueStatus.textContent = outputDirectory ? `Output folder: ${outputDirectory}` : '';
    }
}

function addChangeDirectoryButton() {
    const buttonContainer = document.getElementById('buttonContainer');
    const button = document.createElement('button');
    button.textContent = 'Change Output Folder';
    button.className = 'control-button';
    button.onclick = async () => {
        const selected = await selectOutputDirectory();
        if (selected) {
            updateQueueDisplay();
        }
    };
    buttonContainer.appendChild(button);
}

document.addEventListener('DOMContentLoaded', async () => {
    console.log("DOMContentLoaded")

    initializeSettings();
    addChangeDirectoryButton();

    const versionElement = document.getElementById('appVersion');
    const appVersion = await ipcRenderer.invoke('get-app-version');
    versionElement.textContent = `Version: ${appVersion}`;
});

ipcRenderer.on('conversion-progress', (event, percent) => {
    progressBar.style.width = `${percent}%`;
});

ipcRenderer.on('conversion-complete', (event, outputPath) => {
    status.textContent = `Completed: ${processingQueue[0].name}`;
    processingQueue.shift();
    isProcessing = false;
    progressBar.style.width = '0%';
    updateQueueDisplay();
    processNextInQueue();
});

ipcRenderer.on('conversion-error', (event, error) => {
    status.textContent = `Error processing ${processingQueue[0].name}: ${error}`;
    processingQueue.shift();
    isProcessing = false;
    progressBar.style.width = '0%';
    updateQueueDisplay();
    processNextInQueue();
});

function handleFiles(files) {
    addToQueue(files);
}

function updateOutputFolderDisplay() {
    const outputFolderDisplay = document.getElementById('outputFolderDisplay');
    if (outputDirectory) {
        outputFolderDisplay.textContent = `Output Folder: ${outputDirectory}`;
        outputFolderDisplay.style.display = 'block';
    } else {
        outputFolderDisplay.textContent = 'No output folder selected';
        outputFolderDisplay.style.color = '#666';
    }
}

function initializeSettings() {
    const settingsHeader = document.getElementById('settingsHeader');
    const settingsContent = document.getElementById('settingsContent');
    const arrow = settingsHeader.querySelector('span');

    settingsHeader.addEventListener('click', () => {
        settingsContent.classList.toggle('show');
        arrow.textContent = settingsContent.classList.contains('show') ? '▼' : '▶';
    });

    Object.keys(defaultSettings).forEach(setting => {
        const element = document.getElementById(setting);
        if (element) {
            element.value = defaultSettings[setting];
            element.addEventListener('change', (e) => {
                currentSettings[setting] = e.target.value;
            });
        }
    });

    document.getElementById('resetSettings').addEventListener('click', () => {
        currentSettings = { ...defaultSettings };
        Object.keys(defaultSettings).forEach(setting => {
            const element = document.getElementById(setting);
            if (element) {
                element.value = defaultSettings[setting];
            }
        });
    });
}