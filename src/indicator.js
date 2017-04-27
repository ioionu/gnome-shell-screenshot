// vi: sts=2 sw=2 et

const Lang = imports.lang;
const Signals = imports.signals;

const St = imports.gi.St;
const Cogl = imports.gi.Cogl;
const Shell = imports.gi.Shell;
const Clutter = imports.gi.Clutter;

const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;

const Gettext = imports.gettext.domain('gnome-shell-screenshot');
const _ = Gettext.gettext;

const ExtensionUtils = imports.misc.extensionUtils;
const Local = ExtensionUtils.getCurrentExtension();

const Config = Local.imports.config;
const Convenience = Local.imports.convenience;

const {dump} = Local.imports.dump;


const DefaultIcon = 'camera-photo-symbolic';


const settings = Convenience.getSettings();

const ScreenshotSection = new Lang.Class({
  Name: "ScreenshotTool.ScreenshotSection",

  _init: function (menu) {
    this._image = new PopupMenu.PopupBaseMenuItem();
    this._image.actor.content_gravity =
      Clutter.ContentGravity.RESIZE_ASPECT;

    this._copy = new PopupMenu.PopupMenuItem(_('Copy'));
    this._save = new PopupMenu.PopupMenuItem(_('Save As...'));

    this._image.connect('activate', this._onImage.bind(this));
    this._copy.connect('activate', this._onCopy.bind(this));
    this._save.connect('activate', this._onSave.bind(this));

    menu.addMenuItem(this._image);
    menu.addMenuItem(this._copy);
    menu.addMenuItem(this._save);

    this._setItemsVisible(false);
  },

  _setItemsVisible: function (visible) {
    let items = [this._image, this._copy, this._save];
    items.forEach((i) => {
      i.actor.visible = visible;
    });
  },

  _setImage: function (pixbuf) {
    let {width, height} = pixbuf;
    if (height == 0) {
      return
    }
    let image = new Clutter.Image();
    let success = image.set_data(
      pixbuf.get_pixels(),
      pixbuf.get_has_alpha()
        ? Cogl.PixelFormat.RGBA_8888
        : Cogl.PixelFormat.RGB_888,
      width,
      height,
      pixbuf.get_rowstride()
    );
    if (!success) {
      throw Error("error creating Clutter.Image()");
    }

    this._image.actor.content = image;
    this._image.actor.height = 200;
  },

  setScreenshot: function (screenshot) {
    this._screenshot = screenshot;
    this._setImage(screenshot.gtkImage.get_pixbuf());
    this._setItemsVisible(true);
  },

  _onImage: function () {
    this._screenshot.launchOpen();
  },

  _onCopy: function () {
    this._screenshot.copyClipboard();
  },

  _onSave: function () {
    this._screenshot.launchSave();
  }
})



const Indicator = new Lang.Class({
  Name: "ScreenshotTool.Indicator",
  Extends: PanelMenu.Button,

  _init: function (extension) {
    this.parent(null, Config.IndicatorName);

    this._extension = extension;

    this._signalSettings = [];

    this._icon = new St.Icon({
      icon_name: DefaultIcon,
      style_class: 'system-status-icon'
    });

    this.actor.add_actor(this._icon);
    this.actor.connect('button-press-event', this._onClick.bind(this));

    this._buildMenu();
  },

  _onClick: function (obj, evt) {
    // only override primary button behavior
    if (evt.get_button() !== Clutter.BUTTON_PRIMARY) {
      return;
    }

    let action = settings.get_string(Config.KeyClickAction);
    if (action === 'show-menu') {
      return;
    }

    this.menu.close();
    this._extension.onAction(action);
  },

  _buildMenu: function () {
    // These actions can be triggered via shortcut or popup menu
    const items = [
      ["select-area", _("Select Area")],
      ["select-window", _("Select Window")],
      ["select-desktop", _("Select Desktop")]
    ];

    items.forEach(([action, title]) => {
      let item = new PopupMenu.PopupMenuItem(title);
      item.connect(
        'activate', function (action) {
          this.menu.close();
          this._extension.onAction(action);
        }.bind(this, action)
      );
      this.menu.addMenuItem(item);
    })

    this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

    this._screenshotSection = new ScreenshotSection(this.menu);

    this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

    // Settings can only be triggered via menu
    let settingsItem = new PopupMenu.PopupMenuItem(_('Settings'));
    settingsItem.connect('activate', () => {
      let appSys = Shell.AppSystem.get_default();
      let prefs = appSys.lookup_app('gnome-shell-extension-prefs.desktop');
      if (prefs.get_state() == prefs.SHELL_APP_STATE_RUNNING) {
        prefs.activate();
      } else {
        prefs.get_app_info().launch_uris(
          ['extension:///' + Local.metadata.uuid], null
        );
      }
    });
    this.menu.addMenuItem(settingsItem);
  },

  setScreenshot: function (screenshot) {
    this._screenshotSection.setScreenshot(screenshot);
  },

  destroy: function () {
    this.parent();
    this._signalSettings.forEach((signal) => {
      settings.disconnect(signal);
    });
  }
});
