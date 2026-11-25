/* global __dirname */
// Kiểm tra: Giữ đủ nội dung công thức và tách đúng hashtag từ bài đăng.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
const code=ts.transpileModule(fs.readFileSync(require('node:path').join(__dirname,'../lib/postContent.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
const api={};new Function('exports',code)(api);
test('recipe details retain all steps including paragraphs',()=>{
 const value=api.parsePostContent('Món ngon\n\nTHÔNG TIN MÓN\n20 phút · 2 người\n\nNGUYÊN LIỆU\n• Trứng — 2 quả\n\nCÁCH LÀM\n1. Sơ chế\nRửa rau\n\n2. Nấu\nChiên trứng\n\n#BếpNhà #MónNgon');
 assert.equal(value.intro,'Món ngon');
 assert.equal(value.sections.length,3);
 assert.match(value.sections[2].body,/2\. Nấu\nChiên trứng/);
 assert.deepEqual(value.tags,['#BếpNhà','#MónNgon']);
});
test('plain posts and inline hashtags retain their original text',()=>{
 const value=api.parsePostContent('Mẹo #nấuăn\n\nMột đoạn chia sẻ.');
 assert.equal(value.intro,'Mẹo #nấuăn\n\nMột đoạn chia sẻ.');
 assert.equal(value.sections.length,0);
});

const minimalDraft = {
  mode: 'recipe', title: 'Bữa tối', description: 'Chia sẻ bữa tối của mình.', category: 'Món Việt',
  tags: '', minutes: '', servings: '', difficulty: '', calories: '', protein: '', carbs: '', fat: '',
  ingredients: [{name: '', quantity: '', unit: 'g'}],
  steps: [{title: '', instruction: ''}], tip: '',
};

test('recipe can be submitted with a description and no recipe details', () => {
  assert.deepEqual(api.postDraftIssues(minimalDraft), []);
  assert.equal(api.composePostContent(minimalDraft), minimalDraft.description);
});

test('recipe details cannot substitute for the required description', () => {
  assert.match(api.postDraftIssues({...minimalDraft, description: '  ', minutes: '20'}).join(' '), /mô tả/);
});

test('partially filled optional details are saved without placeholder rows', () => {
  const draft = {
    ...minimalDraft, servings: '2', protein: '0',
    ingredients: [...minimalDraft.ingredients, {name: 'Trứng', quantity: '', unit: 'g'}, {name: 'Rau', quantity: '100', unit: 'g'}],
    steps: [...minimalDraft.steps, {title: 'Sơ chế', instruction: ''}, {title: '', instruction: 'Rửa rau.'}],
  };
  assert.deepEqual(api.postDraftIssues(draft), []);
  const parsed = api.parsePostContent(api.composePostContent(draft));
  assert.deepEqual(parsed.sections.map(section => section.body), [
    '2 người', 'Đạm: 0 g', '• Trứng\n• Rau — 100 g', '1. Sơ chế\n\n2. Bước 2\nRửa rau.',
  ]);
});
