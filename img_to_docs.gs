function onOpen(e) {
	DocumentApp.getUi().createAddonMenu()
		.addItem('Start', 'showSidebar')
		.addToUi();
}

function onInstall(e) {
	onOpen(e);
}

function showSidebar() {
	var ui = HtmlService.createHtmlOutputFromFile('sidebar')
		.setTitle('Img to Docs');
	DocumentApp.getUi().showSidebar(ui);
}

var fakeCursor;
var doc;

function insertLine(txt, brk) {
	doc = DocumentApp.getActiveDocument();
	var selection = doc.getSelection();
	var bullet = txt.startsWith('* ');
	if (bullet) {
		txt = txt.substring(2)
	};

	function curs() {
		if (bullet) {
			insertBullet(txt);
		} else {
			if (brk) {
				var el = fakeCursor.getElement();
				var parentElement = el.getParent();
				var childIndex = parentElement.getChildIndex(el);
				var p = parentElement.insertParagraph(childIndex + 1, txt.substring(1));
				fakeCursor = doc.newPosition(p, 1);
			} else {
				var surroundingText = fakeCursor.getSurroundingText().getText();
				var surroundingTextOffset = fakeCursor.getSurroundingTextOffset();

				if (surroundingTextOffset > 0) {
					if (surroundingText.charAt(surroundingTextOffset - 1) != ' ') {
						txt = ' ' + txt;
					}
				}

				if (surroundingTextOffset < surroundingText.length) {
					if (surroundingText.charAt(surroundingTextOffset) != ' ') {
						txt += ' ';
					}
				}

				fakeCursor.insertText(txt);
				var txtEl = fakeCursor.getElement();
				var txtOff = fakeCursor.getOffset();
				fakeCursor = doc.newPosition(txtEl, txtOff + 1);
			}
		}
	}
	if (selection) {
		var cleared = false;
		var elements = selection.getSelectedElements();
		if (elements.length === 1 && elements[0].getElement().getType() ===
			DocumentApp.ElementType.INLINE_IMAGE) {
			throw new Error('Can\'t insert text into an image.');
		}
		for (var i = 0; i < elements.length; ++i) {
			if (elements[i].isPartial()) {
				var element = elements[i].getElement().asText();
				fakeCursor = doc.newPosition(element, elements[i].getStartOffset());
				if (!cleared) {
					var startIndex = elements[i].getStartOffset();
					var endIndex = elements[i].getEndOffsetInclusive();
					element.deleteText(startIndex, endIndex);
					cleared = true;
				} else {
					var parent = element.getParent();
					var remainingText = element.getText().substring(endIndex + 1);
					parent.getPreviousSibling().asText().appendText(remainingText);
					if (parent.getNextSibling()) {
						parent.removeFromParent();
					} else {
						element.removeFromParent();
					}
				}
			} else {
				var element = elements[i].getElement();
				if (!cleared && element.editAsText) {
					element.clear();
					cleared = true;
				} else {
					if (element.getNextSibling()) {
						element.removeFromParent();
					} else {
						element.clear();
					}
				}
			}
		}
		doc.setCursor(fakeCursor);
		curs();
	} else {
		curs();
	}
}

function insertBullet(txt) {
	fakeCursor.insertText('\r');
	var el = fakeCursor.getElement();
	var parentElement = el.getParent();
	var childIndex = parentElement.getChildIndex(el);

	function recreate(t) {
		if (el.getType() == DocumentApp.ElementType.PARAGRAPH) {
			parentElement.insertParagraph(childIndex, t)
		} else if (el.getType() == DocumentApp.ElementType.LIST_ITEM) {
			parentElement.insertListItem(childIndex, t).setGlyphType(DocumentApp.GlyphType.BULLET);
		}
	}

	var tt = el.getText();
	var sin = fakeCursor.getSurroundingTextOffset();
	var before = tt.substring(0, sin);
	var after = tt.substring(sin + 1);

	if (after !== '') {
		recreate(after);
	}
	var middle = parentElement.insertListItem(childIndex, txt).setGlyphType(DocumentApp.GlyphType.BULLET);
	if (before != '') {
		recreate(before);
	}

	if (el.isAtDocumentEnd()) {
		el.clear()
	} else {
		parentElement.removeChild(el);
	}
	fakeCursor = doc.newPosition(middle, 1);
}

function insertText(txt) {
	doc = DocumentApp.getActiveDocument();
	fakeCursor = doc.getCursor()
	var lines = txt.split('\n');

	if (lines[lines.length - 1] == '') {
		lines.pop();
	}

	for (i = 0; i < lines.length; i++) {
		var line = lines[i];
		var brk = false;
		if (i != 0 && !line.startsWith('* ')) {
			line = '\n' + line;
			if (lines[i - 1].startsWith('* ')) {
				brk = true;
			}
		}
		insertLine(line, brk);
	}
	doc.setCursor(fakeCursor);
}
