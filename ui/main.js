const {app, BrowserWindow, ipcMain, Menu, dialog} = require('electron')
const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const useHarmonyFlag = require('semver').lt(process.version, '6.0.0');
console.log(`Using --harmony-destructuring flag? ${useHarmonyFlag}`);

const template = [
    {
        label: 'View',
        submenu: [
            {
                role: 'resetzoom'
            },
            {
                role: 'zoomin'
            },
            {
                role: 'zoomout'
            },
            {
                type: 'separator'
            },
            {
                role: 'togglefullscreen'
            }
        ]
    },
    {
        role: 'window',
        submenu: [
            {
                role: 'minimize'
            },
            {
                role: 'close'
            }
        ]
    },
    {
        role: 'help',
        submenu: [
            {
                label: 'Learn More',
                click() { require('electron').shell.openExternal('https://github.com/FloEdelmann/fixture-converter') }
            }
        ]
    }
];

if (process.platform === 'darwin') {
    const name = require('electron').remote.app.getName();
    template.unshift({
        label: name,
        submenu: [
            {
                role: 'about',
                click () { require('electron').shell.openExternal('https://github.com/FloEdelmann/fixture-converter') }
            },
            {
                type: 'separator'
            },
            {
                role: 'hide'
            },
            {
                role: 'hideothers'
            },
            {
                role: 'unhide'
            },
            {
                type: 'separator'
            },
            {
                role: 'quit'
            }
        ]
    });
    // Window menu.
    template[2].submenu = [
        {
            label: 'Close',
            accelerator: 'CmdOrCtrl+W',
            role: 'close'
        },
        {
            label: 'Minimize',
            accelerator: 'CmdOrCtrl+M',
            role: 'minimize'
        },
        {
            label: 'Zoom',
            role: 'zoom'
        },
        {
            type: 'separator'
        },
        {
            label: 'Bring All to Front',
            role: 'front'
        }
    ];
}

const menu = Menu.buildFromTemplate(template)
Menu.setApplicationMenu(menu)

let win;

function createWindow() {
    win = new BrowserWindow({width: 800, height: 400});
    win.loadURL(`file://${__dirname}/index.html`);

    //win.toggleDevTools();

    ipcMain.on('requestFormats', event => {
        let formats = fs.readdirSync(path.join(__dirname, '..', 'formats'));
        for (let i=0; i<formats.length; i++) {
            const js = require(path.join(__dirname, '..', 'formats', formats[i]));
            const key = formats[i].replace(/\.js$/, '');

            formats[i] = {
                "key": key,
                "name": js.formatName || key,
                "ext": js.defaultFileExt,
                "defaultFileName": js.defaultFileName || ""
            };
        }
        event.sender.send('formats', formats);
    });

    ipcMain.on('requestEnv', event => {
        event.sender.send('env', process.platform, process.env[(process.platform == 'win32') ? 'USERPROFILE' : 'HOME']);
    });

    ipcMain.on('doConversion', (event, args) => {
        const command = 'node ' + (useHarmonyFlag ? '--harmony-destructuring ' : '')
        + path.join(__dirname, '..', 'fixtures_convert.js') + ' ' + args;
        cp.exec(command, (error, stdout, stderr) => {
            event.sender.send('conversionResults', error, stdout, stderr);
        });
    });

    ipcMain.on('openInputDialog', (event, options) => {
        dialog.showOpenDialog(win, options, filenames => {
            event.sender.send('inputFiles', filenames);
        })
    });

    ipcMain.on('openOutputDialog', (event, options) => {
        dialog.showOpenDialog(win, options, filenames => {
            event.sender.send('outputDirectory', filenames);
        })
    });

    win.on('closed', () => {
        // Dereference the window object, usually you would store windows
        // in an array if your app supports multi windows, this is the time
        // when you should delete the corresponding element.
        win = null;
    });
}

app.on('ready', createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit()
    }
});

app.on('activate', () => {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (win === null) {
        createWindow()
    }
});
