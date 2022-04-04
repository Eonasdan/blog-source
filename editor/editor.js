document.addEventListener('DOMContentLoaded', () => {

    const previewButton = document.getElementById('previewButton');
    const editorDiv = document.getElementById('editorContainer');
    const outputDiv = document.getElementById('output');
    const saveModalButton = document.getElementById('saveModalButton');
    const tagUl = document.getElementById('tagsContainer');
    const form = document.getElementById('postMetaForm');
    const postDate = document.getElementById('postDate');
    const areYouSureModal = bootstrap.Modal.getOrCreateInstance(document.getElementById('areYouSureModal'));
    const areYouSureModalConfirm = document.getElementById('areYouSureModalConfirm');
    const areYouSureModalClose = document.getElementById('areYouSureModalClose');

    const toggleShow = (...elements) => {
        elements.forEach(element => {
            element.classList.toggle('show');
            element.classList.toggle('hide');
        });
    }

    const dateForInput = () => {
        return new Date().toISOString().slice(0, -14)
    }

    const draftEditor = JSON.parse(localStorage.getItem('draft-editor') || '{}');

    const editor = new EditorJS({
        holder: 'editorjs',
        placeholder: 'Let`s write an awesome story!',
        onChange: () => onSave(),
        tools: {
            header: Header,
            checklist: {
                class: Checklist,
                inlineToolbar: true,
            },
            list: {
                class: List,
                inlineToolbar: true,
            },
            image: {
                class: ImageTool,
                config: {
                    endpoints: {
                        byFile: 'build/editor/uploadFile',
                    }
                }
            },
            code: CodeTool,
            inlineCode: {
                class: InlineCode
            },
        },
        data: draftEditor
    });

    const parser = new edjsParser(undefined, {
        code: (data) => {
            if (!data) return '';
            const sanitizeHtml = function (markup) {
                markup = markup.replace(/&/g, "&amp;");
                markup = markup.replace(/</g, "&lt;");
                markup = markup.replace(/>/g, "&gt;");
                return markup;
            }
            let codeClass = '';
            switch (data.languageCode) {
                case 'js':
                    codeClass = 'language-javascript'
                    break;
                case 'typescript':
                    codeClass = 'language-typescript'
                    break;
            }

            return `<pre><code class="${codeClass}">${sanitizeHtml(data.code)}</code></pre>`
        }
    });

    function onSave() {
        editor.save().then(data => {
            if (data) {
                const rawText = data.blocks
                    .flatMap(x => x.data)
                    .filter(x => x.text)
                    .flatMap(x => x.text)
                    .join(' ')
                    .replaceAll('<code class="inline-code">', '')
                    .replaceAll('</code>', '');
                /* const response = fetch('http://localhost:8010/v2/check', {
                *    method: 'POST',
                     body: JSON.stringify({
                         data: {
                             text: parsed
                         },
                         language: 'en-US'
                     })
                 })
                     .then(response => response.json()).then(x => {
                         debugger;
                     });*/

                localStorage.setItem('draft-editor', JSON.stringify(data));
                //return;
            }
            /*document.getElementById('mustHaveData').classList.add('show');
            saveModalButton.setAttribute("disabled", "true");
            previewButton.setAttribute("disabled", "true");*/
        });
    }

    /*document.getElementById('saveModalButton').addEventListener('click', () => {
        editor.save().then(data => {
            if (!data) {
                return;
            }
            const saveModal = new bootstrap.Modal(document.getElementById('saveModal'));
            saveModal.show()
        });
    });*/

    previewButton.addEventListener('click', () => {
        if (previewButton.innerText === 'Preview') {
            editor.save().then(data => {
                document.getElementById('previewContent').innerHTML = parser.parse(data);
                Prism.highlightAll();
            });
        }

        previewButton.innerText = previewButton.innerText === 'Preview' ? 'Editor' : 'Preview';

        toggleShow(editorDiv, outputDiv);
    });

    document.getElementById('save').addEventListener('click', async () => {
        if (!form.checkValidity()) return;
        const outputData = await editor.save();
        if (!outputData) return;
        form.classList.add('was-validated');
        const formData = new FormData(form);
        formData.append('editor', JSON.stringify(outputData));
        const response = await (await fetch('/editor/save', {
            method: 'POST',
            body: formData
        })).json();
        if (response.success) {
            setTimeout(() => {
                //todo toast.
                window.location.href = response.post;
            }, 1.5 * 1000);
        } else {
            const toast = new bootstrap.Toast(document.getElementById('errorMessage'));
            toast.show();
        }
        //todo do something here. need to check success or failure. redirect to post? need to allow overwrite? special if edit works
    });

    document.getElementById('clearButton').addEventListener('click', () => {
        areYouSureModal.show();

        const clear = () => {
            editor.clear();
            form.reset();
            postDate.value = dateForInput();
            metaBlur({target: {name: 'postDate', value: postDate.value}});
            areYouSureModalConfirm.removeEventListener('click', clear);
            areYouSureModal.hide();
        }

        const cancel = () => {
            areYouSureModalClose.removeEventListener('click', cancel);
        }

        areYouSureModalConfirm.addEventListener('click', clear);
        areYouSureModalClose.addEventListener('click', cancel);
    });

    const formatter = new Intl.DateTimeFormat(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "numeric",
        minute: "numeric",
        second: "numeric",
    });

    function metaBlur(event) {
        const input = event.target;
        switch (input.name) {
            case 'title':
                outputDiv.getElementsByClassName('post-title')[0].innerText = input.value;
                break;
            case 'thumbnail':
                if (input?.files?.length === 0) return;

                const reader = new FileReader();
                reader.addEventListener("load", (e) => {
                    document.querySelector('#post-thumbnail img').src = e.target.result;
                }, false);

                reader.readAsDataURL(input.files[0]); //todo should probably move this so it's not recreated every time
                break;
            case 'postDate':
                outputDiv.getElementsByClassName('post-date')[0].innerText = formatter.format(new Date(input.value));
                break;
            case 'tags':
                tagUl.innerText = '';
                input.value.split(',').map(tag => tag.trim()).forEach(tag => {
                    const li = document.createElement('li');
                    const a = document.createElement('a');
                    a.setAttribute('href', `/?search=tag:${tag}`);
                    a.innerHTML = tag;
                    li.appendChild(a);
                    tagUl.appendChild(li);
                });
                break;
            case 'postAuthorName':
                outputDiv.getElementsByClassName('post-author')[0].innerText = input.value;
                break;
            /*case 'postAuthorUrl':
                outputDiv.getElementsByClassName('')[0].innerText = input.value;
                break;*/
        }
        localStorage.setItem('draft-meta', JSON.stringify(
            [...form.querySelectorAll('input, textarea')].filter(x => x.id !== 'thumbnail').reduce((object, element) => {
                object[element.id] = element.value;
                return object;
            }, {})
        ));
    }

    document.getElementById('postMeta').querySelectorAll('input, textarea').forEach(e => {
        e.addEventListener('blur', metaBlur)
    });

    function restoreForm() {
        const data = JSON.parse(localStorage.getItem('draft-meta') || '{}');

        const {elements} = form;

        for (const [key, value] of Object.entries(data).filter(x => x[0] !== 'thumbnail')) {
            const field = elements.namedItem(key);
            if (field) {
                field.value = value
                field.blur();
            }

        }
    }

    restoreForm();

    if (!postDate.value) {
        postDate.value = dateForInput();
        postDate.blur();
    }
});