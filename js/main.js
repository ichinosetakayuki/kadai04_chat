
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.9.0/firebase-app.js";
import {
  getFirestore,
  collection,
  doc,
  addDoc,
  deleteDoc,
  updateDoc,
  serverTimestamp,
  query,
  orderBy,
  onSnapshot,
} from "https://www.gstatic.com/firebasejs/11.9.0/firebase-firestore.js";

import firebaseConfig from "./firebaseConfig.js";

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);


// データ登録
$("#send").on("click", function () {
  const msg = {
    name: $("#userName").val(),
    text: $("#text").val(),
    time: serverTimestamp(),
    iconUrl: $("#selectedIcon").attr("src")
  };
  if(msg.name === "" || msg.text === "") {
    alert('名前またはメッセージの入力がありません');
    return;
  }
  addDoc(collection(db, "chat"), msg);
  $("#text").val("");
});

// Firestore形式のデータを入力して、配列形式のでーたを出力する関数
function chatDocuments(fireStoreDocs) {
  const documents = [];
  fireStoreDocs.forEach(function (doc) {
    const document = {
      id: doc.id,
      data: doc.data(),
    };
    documents.push(document);
  });
  return documents;
}


let moritakaInterval = null; //setInterval()をグローバル化
let lastMoritakaOverlayPostIds = []; //最後にmortakaOverlayが発動した時の３つのidの配列

// chatDocumentsを入力し、最新３投稿に森高ワードが含まれてるかチェックし、
// 含まれていれば、moritakaOverlayを発動する関数
function checkMoritakaAndShowOverlay(chatDocuments) {
  const sortedDocs = chatDocuments.slice().sort((a, b) => {
    return (b.data.time?.seconds || 0) - (a.data.time?.seconds || 0);
  }); //chatDocumentsをslice()でコピーして、降順にソート（b-aが降順）
  const lastThree = sortedDocs.slice(0, 3); //配列の最初の３つ（最新の３つ）を切り出す
  const lastThreeIds = lastThree.map(doc => doc.id); //上記の配列から、idのみを取り出した配列を作る
  const allIncludeMoritaka = lastThree.every((doc) => {
    const text = doc.data.text;
    return /(森高千里|moritaka|もりたか|モリタカ|森高|chisato|ちさと|チサト|千里)/i.test(text);
  }); //大文字小文字も含め（iがその意味）森高ワードが３つの投稿すべてに含まれていたらtrueを返す
  const isSameAsLastOverlay = JSON.stringify(lastThreeIds) === JSON.stringify(lastMoritakaOverlayPostIds);
  // 最新の３投稿のid配列と最後にmoritakaOverlayが発動した時のid配列が同じであればtrueを返す
  // 同じ投稿でoverlayが２回発動しないようにするため


  if (allIncludeMoritaka && !isSameAsLastOverlay) {
    lastMoritakaOverlayPostIds = lastThreeIds;
    // 最新の３投稿が森高ワードを含み、かつ最後にoverlayが発動した時と異なる３投稿であれば
    // moritakaOverlayを発動し、lastMoritakaOverlayPostIdsを最新３投稿のidに置き換える

    // moritakaOverlayを画面全体に表示させる
    const overlay = $(`
      <div id="moritakaOverlay">
        <div class="overlay_content">
          <img src="img/moritaka_img09.png" class="moritaka_img" alt="森高">
          <p class="moritaka_msg"></p>
          <div class="buttons">
            <button id="yesBtn" class="btn">Yes</button>
            <button id="noBtn" class="btn">No</button> 
          </div>        
        </div>
      </div>
      `);
    setTimeout(() => {
      $("body").append(overlay);
      $(".moritaka_img").fadeIn(1000, function () {
        const msgText = '森高はあなたの"推し"になれますか？';
        const msgElement = $(".moritaka_msg");
        msgElement.empty().fadeIn(1000);
        let i = 0;

        // 以下、テキストを１文字ずつ表示させる挙動
        if (moritakaInterval) clearInterval(moritakaInterval); //setintervalが残っていたら空にする
        moritakaInterval = setInterval(() => {
          const remaining = msgText.slice(i); //i番目から残り全部
          if (remaining.startsWith("森高")) { // テキストが"森高"で始まる場合
            msgElement.append('<span class="msg01">森高</span>');
            i += 2; // iを２つ進める
          } else if (remaining.startsWith('"推し"')) { //"推し"で始まる場合
            msgElement.append('<span class="msg02">"推し"</span>');
            i += 4; // 4文字進める
          } else {
            msgElement.append(msgText[i]);
            i++; // それ以外は1文字進める
          }
          if (i >= msgText.length) {
            clearInterval(moritakaInterval);
            moritakaInterval = null;
          }
        }, 200); //文字の表示間隔0.2秒
      });
      setTimeout(() => { // overlayをfadeOutで取り除く
        overlay.fadeOut(1000, () => {
          overlay.remove();
        });
      }, 10000); //overlayのfadeOutは10秒後
    }, 1000); // overlay発動は1秒後
  }
}

// 配列形式のデータを入力して、表示用タグに入れて出力する関数
function chatElements(chatDocuments) {
  const elements = [];

  chatDocuments.forEach((document) => {
    const myName = $("#userName").val(); //入力した名前をmyNameに
    const isMine = document.data.name === myName; //firestoreのnameとmyNameが同じなら、isMine:true
    // isMine:trueなら、contentEditable:trueになり、自分が投稿したテキストの修正が可能
    const alignClass = isMine ? "my_post" : "other_post"; //isMine:true→クラス名:my_post、false→other_post
    // 値が存在するかチェックしてから、secondsを読む
    const timeStamp = convertTimestampToDatetime(document.data.time?.seconds);
    // 投稿の描画
    elements.push(`
      <div id="${document.id}" class="post ${alignClass}">
        <p class="msg_name">${document.data.name}</p>
        <div class="msg_wrapper">
          <img src="${document.data.iconUrl}" class="send_icon">
          <div contentEditable=${isMine} id="${document.id}_update" class="msg_text">${document.data.text}</div>
          <div class="menu_wrapper">
            <span class="menu_icon">︙</span>
            <ul class="menu">
              <li class="remove" data-key="${document.id}">削除</li>
              <li class="update" data-key="${document.id}">更新</li>
            </ul>
          </div>
        </div>
        <div class="time"><span data-key="${document.id}">${timeStamp}</span></div>
      </div>
    `);
  });

  return elements;
}

// データ取得時の条件を指定
const q = query(collection(db, "chat"), orderBy("time", "asc"));

// データを取得する処理
onSnapshot(q, (querySnapshot) => {
  // メッセージを投稿するとonSnapshotリスナーに通知されるが、
  // serverTimestampはまだサーバーで確定されていないためnullが返され、
  // スナップショットのmetadata.hasPendingWritesがtrueになる（保留中の書き込みがあることを示す）。
  // 次にサーバーが書き込みを受信し、serverTimestampが確定、クライアントに同期すると
  // onSnapshotリスナーに再度通知が送られ、serverTimestampに正しい値が入り、HasPendingWritesがfalseになる。
  const isHasPendingWrites = querySnapshot.metadata.hasPendingWrites;
  if(isHasPendingWrites) return; // HasPendingWritesがtrueの時は何もしない。
  // HasPendingWritesがfalse(severTimestampに正しい値が入った)の時、以降の処理に進む。

  // ここは毎回同じ！！よくわからないデータをきれいな形にする
  const documents = chatDocuments(querySnapshot.docs);
  // きれいな形に変換したデータを表示用タグにいれた状態に変換する
  const elements = chatElements(documents);
  // 画面にタグを表示する。
  $("#output").html(elements);
  $("#output").animate({ scrollTop: $("#output")[0].scrollHeight }, 500);
  //投稿が増えると自動的にゆっくりと下にスクロール
  checkMoritakaAndShowOverlay(documents); // 森高ワード3連投なら、moritakaOverlayが発動
  playSound("#postSound"); //効果音の再生
});


// moritakaOverlayのyesボタンをクリックした時の森高投稿
$(document).on("click", "#yesBtn", function () {
  const moritakaReplyArray = [
    "ありがとう！これからもずっとよろしくね❤️",
    "ありがとう！一緒に盛り上がりましょう❣️",
    "わたしに推し活してくれてうれしい❣️",
    "でも、わたしだけじゃないんでしょ？"
  ];
  const r = Math.floor(Math.random() * moritakaReplyArray.length);
  const moritakaReply = moritakaReplyArray[r];
  const msg = {
    name: "森高",
    text: moritakaReply,
    time: serverTimestamp(),
    iconUrl: "img/moritaka_img11.png"
  };
  setTimeout(() => {
    addDoc(collection(db, "chat"), msg);
  }, 6000);
});

// moritakaOverlayのnoボタンをクリックした時の森高投稿
$(document).on("click", "#noBtn", function () {
  const moritakaReplyArray = [
    "そっか、またライブに来てね！",
    "わたしも推し活、見つけようかな〜",
    "そっか、ま、いいけど。うふふ"
  ];
  const r = Math.floor(Math.random() * moritakaReplyArray.length);
  const moritakaReply = moritakaReplyArray[r];
  const msg = {
    name: "森高",
    text: moritakaReply,
    time: serverTimestamp(),
    iconUrl: "img/moritaka_img11.png"
  };
  setTimeout(() => {
    addDoc(collection(db, "chat"), msg);
  }, 6000);
});

// 投稿の削除、更新ボタン表示
$("#output").on("click", ".menu_icon", function (e) {
  $(this).siblings(".menu").toggle();
  e.stopPropagation(); //クリックを親要素に影響させない
});

// 画面のどこかをクリックしたら、削除、更新ボタン非表示
$(document).on("click", function () {
  $(".menu").hide();
});

// 投稿の削除イベント
$("#output").on("click", ".remove", function () {
  const key = $(this).attr("data-key");
  deleteDoc(doc(db, "chat", key));
});

// 投稿を編集し更新するイベント
$("#output").on("click", ".update", function () {
  const key = $(this).attr("data-key");
  updateDoc(doc(db, "chat", key), {
    text: $(`#${key}_update`).html()
  });
});

// リロード時にmy_postを保持するため、ユーザー名をストレージに保存
$("#userName").on("change", function () {
  const chatUser = {
    name: $(this).val(),
    iconUrl: $("#selectedIcon").attr("src")
  }
  localStorage.setItem("chatUser", JSON.stringify(chatUser));
});


// リロード時に保存したユーザー名を読み込み
$(document).ready(function () {
  const savedUser = JSON.parse(localStorage.getItem("chatUser"));
  if (savedUser) {
    $("#userName").val(savedUser.name);
    $("#selectedIcon").attr("src", savedUser.iconUrl);
  }
});

// アイコン選択画面(iconList)の表示、非表示
$("#selectedIcon").on("click", function () {
  $("#iconList").toggle();
})

// アイコンを選択すると、そのアイコンのURLを読み取り、アイコン枠のsrcに入れる。
$(".icon_list").on("click", function () {
  const selectedIconUrl = $(this).attr("src");
  $("#selectedIcon").attr("src", selectedIconUrl);
  $("#iconList").hide();
});

// 投稿があったときの効果音の関数定義
function playSound(sound) {
  const soundEffect = $(sound).get(0);
  soundEffect.currentTime = 0;
  soundEffect.play();
}

// 日付を体裁を整える関数
function convertTimestampToDatetime(timestamp) {
  const _d = timestamp ? new Date(timestamp * 1000) : new Date();
  const Y = _d.getFullYear();
  const m = (_d.getMonth() + 1).toString().padStart(2, '0');
  const d = _d.getDate().toString().padStart(2, '0');
  const H = _d.getHours().toString().padStart(2, '0');
  const i = _d.getMinutes().toString().padStart(2, '0');
  // const s = _d.getSeconds().toString().padStart(2, '0');
  return `${Y}-${m}-${d} ${H}:${i}`;
}
