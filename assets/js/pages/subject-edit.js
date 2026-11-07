(function () {
  'use strict';

  var BB = window.BB;
  var form = BB.subjectForm;
  var t = BB.i18n.t;

  function state() {
    return BB.store.get();
  }

  function findSubject(id) {
    var found = null;
    state().subjects.forEach(function (subject) {
      if (subject.id === id) found = subject;
    });
    return found;
  }

  var params = new URLSearchParams(window.location.search);
  var requestedId = params.get('id');
  var source = requestedId ? findSubject(requestedId) : null;
  /* id 無しは新規作成。以前は先頭科目が無言で開いていた（監査 C6）。 */
  var isNew = !source;
  var draft = isNew ? form.blank() : JSON.parse(JSON.stringify(source));
  var host = document.getElementById('editor');

  BB.ui.mount({
    title: isNew ? t('se.addTitle') : t('se.editTitle'),
    head: {
      title: isNew ? t('se.addTitle') : t('se.editTitle'),
      subtitle: isNew ? t('se.addSubtitle') : t('se.editSubtitle'),
      actions:
        '<a href="settings.html" class="bb-btn bb-btn-ghost">' + t('se.cancel') + '</a>' +
        '<button type="button" id="save-subject" class="bb-btn bb-btn-primary">' +
        '<span class="material-symbols-outlined text-[18px]">check</span>' +
        (isNew ? t('se.add') : t('se.save')) + '</button>'
    }
  });

  function render() {
    form.render(host, draft, { deleteButton: !isNew });
  }

  function save() {
    form.sync(host, draft);

    var error = form.validate(draft, { exceptId: isNew ? undefined : source.id });
    if (error) {
      BB.ui.toast(error);
      return;
    }

    if (isNew) {
      var created = JSON.parse(JSON.stringify(draft));
      created.marks = {};
      BB.store.update(function (data) {
        data.subjects.push(created);
      });
      BB.ui.toast(t('se.toastAdded', { id: created.id }));
      window.location.href = 'settings.html';
      return;
    }

    var keep = {};
    draft.assessments.forEach(function (assessment) {
      if (source.marks && typeof source.marks[assessment.id] === 'number') {
        keep[assessment.id] = source.marks[assessment.id];
      }
    });
    draft.marks = keep;

    BB.store.update(function (data) {
      data.subjects = data.subjects.map(function (subject) {
        return subject.id === source.id ? draft : subject;
      });
    });
    BB.ui.toast(t('se.toastSaved'));
    window.location.href = 'settings.html';
  }

  form.bind(host, draft, render);

  document.addEventListener('click', function (event) {
    if (event.target.closest('#save-subject') || event.target.closest('#save-subject-bottom')) {
      save();
      return;
    }

    if (event.target.closest('#delete-subject')) {
      BB.ui
        .confirm({
          title: t('se.confirm.title', { id: source.id }),
          message: t('se.confirm.body', { name: source.name }),
          confirmLabel: t('se.confirm.ok'),
          danger: true
        })
        .then(function (ok) {
          if (!ok) return;
          BB.store.update(function (data) {
            data.subjects = data.subjects.filter(function (subject) {
              return subject.id !== source.id;
            });
          });
          window.location.href = 'settings.html';
        });
    }
  });

  render();

  /* 他タブの保存を取り込む。編集中の入力は draft へ戻してから描き直すので消えない
     （フォームの行追加・行削除・色選択と同じ経路）。 */
  BB.store.subscribe(function () {
    /* source も開いた時点のオブジェクトのまま。保存済みの最新に付け替えないと、
       他のタブで入力された点数を保存時に消してしまう。 */
    if (!isNew && source) {
      var fresh = findSubject(source.id);
      if (fresh) source = fresh;
    }
    form.sync(host, draft);
    BB.ui.refreshChrome();
    render();
  });
})();
