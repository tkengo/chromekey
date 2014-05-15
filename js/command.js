/**
 * Copyright (c) 2013 Kengo Tateishi (@tkengo)
 * Licensed under MIT license.
 *   http://www.opensource.org/licenses/mit-license.php
 *
 * Define command used in Hometype.
 */
var Command = {};

/**
 * Noop command.
 */
Command.noop = function() { };

/**
 * Scroll down.
 */
Command.scrollDown = function() {
  Viewport.scrollVertical(parseInt(Opt.scroll_amount));
};

/**
 * Scroll up.
 */
Command.scrollUp = function() {
  Viewport.scrollVertical(-parseInt(Opt.scroll_amount));
};

/**
 * Scroll down half display.
 */
Command.scrollDownHalf = function() {
  Viewport.scrollVertical(Viewport.getWindowSize().height / 2);
};

/**
 * Scroll up half display.
 */
Command.scrollUpHalf = function() {
  Viewport.scrollVertical(-Viewport.getWindowSize().height / 2);
};

/**
 * Scroll down display.
 */
Command.scrollDownPage = function() {
  Viewport.scrollVertical(Viewport.getWindowSize().height);
};

/**
 * Scroll up display.
 */
Command.scrollUpPage = function() {
  Viewport.scrollVertical(-Viewport.getWindowSize().height);
};

/**
 * Scroll to document top.
 */
Command.scrollToTop = function() {
  Viewport.scrollTo(0, 0);
};

/**
 * Scroll to document bottom.
 */
Command.scrollToBottom = function() {
  Viewport.scrollTo(0, Viewport.getDocumentSize().height);
};

/**
 * Close the current tab.
 */
Command.closeTab = function() {
  chrome.runtime.sendMessage({ command: 'closeTab' });
};

/**
 * Move to left tab.
 */
Command.moveLeftTab = function() {
  chrome.runtime.sendMessage({ command: 'moveLeftTab' });
};

/**
 * Move to right tab.
 */
Command.moveRightTab = function() {
  chrome.runtime.sendMessage({ command: 'moveRightTab' });
};

/**
 * Select next candidate in a command box.
 */
Command.selectNextCandidate = function() {
  Mode.getProcessor(ModeList.COMMAND_MODE).getCommandBox().selectNext();
};

/**
 * Select previous candidate in a command box.
 */
Command.selectPrevCandidate = function() {
  Mode.getProcessor(ModeList.COMMAND_MODE).getCommandBox().selectPrev();
};

/**
 * Focus out from an active element.
 */
Command.cancelInsertMode = function() {
  $(document.activeElement).blur();
  Mode.release();
  Mode.changeMode(ModeList.NORMAL_MODE);
};

/**
 * Back history.
 */
Command.backHistory = function() {
  window.history.back();
};

/**
 * Foward history.
 */
Command.forwardHistory = function() {
  window.history.forward();
};

/**
 * Restore closed tabs.
 */
Command.restoreTab = function() {
  chrome.runtime.sendMessage({ command: 'restoreTab' });
};

/**
 * Focus first element in window.
 */
Command.focusFirstInput = function() {
  $(':insertable:screen:first').focus();
};

/**
 * Focus last element in window.
 */
Command.focusLastInput = function() {
  $(':insertable:screen:last').focus();
};

/**
 * Search a tab from closed tab list.
 */
Command.searchClosedTabs = function() {
  var processor = Mode.changeMode(ModeList.COMMAND_MODE);

  processor.onEnter(function(text, selected) {
    chrome.runtime.sendMessage({ command: 'restoreTab', params: selected.tabId });
  });

  chrome.runtime.sendMessage({ command: 'closedTabList' }, function(closedTabs) {
    processor.onUpdateBoxText(function(text) {
      var list = [];
      $.each(closedTabs, function(index, tab) {
        if (tab && Utility.includedInProperties(tab, text, [ 'title', 'url' ])) {
          var listText = Utility.pad(list.length + 1, 2) + ': ' + tab.title + '(' + tab.url + ')';
          list.push({ text: listText, url: tab.url, tabId: tab.id });
        }
      });
      return list;
    }, true);
  });
};

/**
 * Search a bookmark from chrome bookmark list.
 */
Command.searchBookmarks = function(newTab) {
  var processor = Mode.changeMode(ModeList.COMMAND_MODE);

  processor.onEnter(function(text, selected) {
    chrome.runtime.sendMessage({ command: 'createTab', params: { url: selected.url } });
  });

  var port = chrome.runtime.connect({ name: 'loadBookmarks' });
  port.onMessage.addListener(function(bookmarks) {
    processor.onUpdateBoxText(function(text) {
      var list = [];
      $.each(bookmarks, function(index, bookmark) {
        if (Utility.includedInProperties(bookmark, text, [ 'title', 'url' ])) {
          list.push({ text: bookmark.title + '(' + bookmark.url + ')', url: bookmark.url });
        }
      });
      port.disconnect();
      return list;
    });
  });
  port.postMessage();
};

/**
 * Search a history.
 */
Command.searchHistories = function() {
  var processor = Mode.changeMode(ModeList.COMMAND_MODE);

  processor.onEnter(function(text, selected) {
    Utility.openUrl(selected.url);
  });

  chrome.runtime.sendMessage({ command: 'getHistories' }, function(histories) {
    processor.onUpdateBoxText(function(text) {
      var list = [];
      $.each(histories, function(index, history) {
        if (Utility.includedInProperties(history, text, [ 'title', 'url' ])) {
          list.push({ text: history.title + '(' + history.url + ')', url: history.url });
        }
      });
      return list;
    }, true);
  });
};

/**
 * Enter the visual mode.
 */
Command.enterVisualMode = function() {
  var targets = Dom.searchVisibleElementsFrom(Dom.visualableXPath());
  if (targets.length > 0) {
    var processor = Mode.enterHintMode('red', targets);
    processor.onChooseElement(function(element) {
      Mode.enterVisualMode(element);
      return false;
    });
  }
};

/**
 * Enter the hint mode. Hint targets are clickable and form elements.
 */
Command.enterHintMode = function(option) {
  // Collect hint source targets.
  var targets = Dom.searchVisibleElementsFrom(Dom.clickableAndInsertableXPath());
  var newTab = option.new || false;
  var theme = newTab ? 'blue' : 'yellow';

  // Do nothing if there are not targets or the current mode is the insert mode.
  if (targets.length == 0 || Mode.isInsertMode()) {
    return;
  }

  // Set continuous state in background if continuous option is true.
  if (option.continuous) {
    chrome.runtime.sendMessage({ command: 'enterContinuousMode' });
  }

  // enter the hint mode, and register event listener to handle choosen element.
  // 1. If choosen element is form tag, focus to it.
  // 2. If choosen element is select tag, open the select box.
  // 3. Otherwise, emulate click event for an element.
  var processor = Mode.enterHintMode(theme, targets);
  processor.onChooseElement(function(element) {
    if (Dom.isEditable(element.get(0))) {
      element.focus();
      return true;
    } else if (element.is('select')) {
      var selectBox = new HometypeSelectBox(element);
      processor.createHints('yellow', selectBox.getListElements());
      processor.onNotifyLeaveMode(function() { selectBox.remove(); });
    } else {
      Utility.clickElement(element, newTab);
      if (!option.continuous) {
        return true;
      }
      setTimeout(function() { Command.enterHintMode(option); }, 300);
    }

    return false;
  });
};

/**
 * Enter the insert mode.
 */
Command.enterInsertMode = function() {
  Mode.changeMode(ModeList.INSERT_MODE);
  Mode.lock();
};

/**
 * Enter the command mode.
 */
Command.enterCommandMode = function() {
  Mode.changeMode(ModeList.COMMAND_MODE);
};

/**
 * Enter the normal mode.
 */
Command.enterNormalMode = function() {
  Mode.changeMode(ModeList.NORMAL_MODE);
};

Command.showAssignedCommands = function() {
  Mode.changeMode(ModeList.HELP_MODE);
};

/**
 * Defined alias.
 */
Command.cancelCommandMode = Command.enterNormalMode;
Command.cancelHintMode    = Command.enterNormalMode;
Command.cancelVisualMode  = Command.enterNormalMode;
Command.cancelHelpMode    = Command.enterNormalMode;
