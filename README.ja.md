# Phase Pal Music Bridge

[English](README.md) · [简体中文](README.zh-CN.md) · [Русский](README.ru.md) · [Español](README.es.md) · [日本語](README.ja.md)

ブラウザーの再生状態を Phase Pal の **Dance to Music** 機能に連携する拡張機能です。任意で有効にできるビート解析は、お使いのデバイス上で行われます。Consistency AI が管理しています。

**プレビュー版：** ソースコードは MIT ライセンスで公開されています。ウサギのアートワークには別の利用条件が適用されます。これは Chrome ウェブストアの正式リリースでも、署名済みの Phase Pal インストーラーでもありません。ブラウザー連携用ブリッジを同梱した互換性のあるデスクトップアプリが別途必要です。このリポジトリには含まれていません。実際の Chrome での再生と、パッケージ化されたアプリでの動作確認は未完了です。

## セットアップとプライバシー

- [セットアップガイド](https://consistencyai.github.io/phasepal_extension/)（英語）
- [プライバシーポリシー](https://consistencyai.github.io/phasepal_extension/privacy/)（英語）
- [データの取り扱いと権限の技術資料](docs/PRIVACY.md)
- [開発とネイティブホストのセットアップ](docs/DEVELOPMENT.md)

## 主な機能

Spotify Web、YouTube Music、SoundCloud、Apple Music、Amazon Music の地域別プレーヤー、Deezer、TIDAL、Qobuz、Pandora、Yandex Music、QQ Music、KuGou、JioSaavn、LINE MUSIC、Bugs、JOOX、Anghami、Audiomack の再生中・一時停止の状態を通知します。[対象ホストと検証範囲](docs/SUPPORTED_SITES.md)をご確認ください。ポップアップの **Custom websites（カスタムサイト）** から個別のサイトを追加することもできます。そのサイトへのアクセスは Chrome の許可が必要です。[カスタムサイトの設定](docs/CUSTOM_SITES.md)をご覧ください。

対応サイトでの再生は音楽として扱われます。会話、ポッドキャスト、広告でもダンスが始まる場合があります。楽曲と音声を分類する機能ではありません。アカウント、サブスクリプション、地域、保護されたコンテンツ、プレーヤーの制限は引き続き適用されます。正式な動作確認済みリリースに向けて、各連携で実際の再生を確認する必要があります。

## 拡張機能の使い方

1. Windows または macOS で Chrome 116 以降を使用し、ブラウザー用ブリッジを同梱・登録する互換性のある Phase Pal ビルドを用意してください。現在のインストール手順は Linux や他のブラウザーには対応していません。拡張機能の更新だけでは、古いアプリにブリッジは追加されません。
2. この開発者向けプレビューでは、[Releases](https://github.com/ConsistencyAI/phasepal_extension/releases) から `phasepal-music-bridge-preview-0.1.0.zip` をダウンロードして展開します。`chrome://extensions` で **Developer mode（デベロッパーモード）** を有効にし、**Load unpacked（パッケージ化されていない拡張機能を読み込む）** を選択して、`manifest.json` を含むフォルダーを指定します。別途用意されているストア用 ZIP は開発者ダッシュボードへのアップロード専用で、開発用の公開鍵を含みません。
3. Phase Pal を開いて **Dance to Music** を有効にします。対応サイトまたは許可済みのカスタムサイトで再生を開始し、拡張機能のポップアップを開いて接続状態を確認します。
4. **Enable Beat Sync（ビート同期を有効化）** を選択すると、そのタブの音声をローカルで解析します。Chrome にキャプチャ中の表示が出ますが、タブの音声は引き続き聞こえます。**Stop Beat Sync（ビート同期を停止）** で終了します。

**Auto Beat Sync（自動ビート同期）** は初期状態ではオフで、設定はこのデバイスにのみ保存されます。有効な場合、準備の整った音楽タブでポップアップを開くと、キャプチャを一度試みます。許可済みのストリームは、一時停止や同じサイト内での曲の切り替え中も維持できます。別のタブや終了したストリームで新たにキャプチャするには、拡張機能を再度呼び出すか Enable をクリックする必要があります。この設定は、ユーザーの操作なしに新しいキャプチャを行う権限を与えるものではありません。Stop、Auto Beat Sync のオフ、Dance to Music のオフ、アプリとの切断、サイト権限の喪失、サイトからの移動、タブを閉じる操作、ストリームの終了によってキャプチャは停止します。

サイト上の閉じることができるリマインダーは、ツールバーのポップアップを開くよう案内します。**Not now（今はしない）** は現在のドキュメント内でのみ有効です。**Don't show again（今後表示しない）** はローカル設定として保存され、サイトの切り替えや再起動後も適用されます。拡張機能を無効化または削除すると、再生状態の通知も停止します。

## データはローカルで処理

会話や広告を含むタブの音声は、拡張機能のメモリー内で解析されます。マイクへのアクセス、録音、文字起こし、分析用テレメトリー、リモートへのアップロードは行いません。ローカルの Phase Pal アプリに送信するのは、固定形式の再生フラグとサービス識別子、メタデータの有無を示す真偽値、セッション・プロトコルのフィールド、数値化されたリズム情報のみです。曲名、アーティスト名、URL、ページのテキスト、閲覧履歴、生の音声は送信しません。カスタムサイトのオリジンと 2 つの設定は Chrome 内にローカル保存されます。Phase Pal、Chrome、音楽サービスには、それぞれ独自のデータ取り扱い方針があります。[データ取り扱い範囲の詳細](docs/PRIVACY.md)をご確認ください。

## ビルドとチェック

Node.js 22.x 系の 22.12 以降、または Node.js 24 以降と、npm、リポジトリにコミット済みのロックファイルを使用します。

```bash
npm ci
npm run check
```

生成された `dist/` ディレクトリを、パッケージ化されていない拡張機能として読み込みます。開発用の拡張機能 ID は `depmepnaojmbbjgogihalfgeajkfkbjj` で、ネイティブホスト `app.phasepal.music` の許可設定と一致する必要があります。マニフェスト内の公開鍵はこの ID を固定するためのもので、秘密の認証情報ではありません。

[開発とネイティブホストのコマンド](docs/DEVELOPMENT.md)、[V1 設計](docs/DESIGN.md)、[貢献ガイド](CONTRIBUTING.md)をご覧ください。互換性のあるパッケージ版アプリを使う一般ユーザーに、Rust、Python、ホストの手動インストールは不要です。ホストの開発には Rust 1.85 以降、Python 3、プラットフォームに対応するビルドツールが必要です。

```bash
cargo test --manifest-path native-host/Cargo.toml --locked
npm run package:store
```

パッケージ作成には Python 3 が必要です。2 つの ZIP とチェックサムは `BuildArtifacts/chrome-web-store/0.1.0/` に出力されます。プレビュー用 ZIP は開発用の公開鍵を保持し、ストアへのアップロード用 ZIP はその鍵を除きます。Google が割り当てたストア ID を確認し、その ID に対応するアプリを配布する前に、両方のネイティブホストのソースとアプリの登録設定を整合させてください。ネイティブ実行ファイルは含まれません。ローカルテストでは、実際の Chrome キャプチャやパッケージ版アプリの動作は確認できません。CI は設定されていません。

## リリースとサポート

拡張機能の ZIP とチェックサムは [GitHub Releases](https://github.com/ConsistencyAI/phasepal_extension/releases) から入手できます。ビルド成果物、音声、キャッシュ、個人設定、秘密情報を Git にコミットしないでください。

連絡先：[hello@consistencyai.net](mailto:hello@consistencyai.net)。[セキュリティ問題の報告](SECURITY.md)と[行動規範](CODE_OF_CONDUCT.md)もご確認ください。ソースコードと文書には [MIT ライセンス](LICENSE) が適用され、ビルド成果物には依存関係のライセンスも適用されます。ウサギのアートワークには [NOTICE](NOTICE) に記載された別の条件が適用されます。
