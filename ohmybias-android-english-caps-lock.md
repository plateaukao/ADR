2026-11-08

英文 Shift 支援大寫鎖定

原本英文鍵盤的 Shift 只會將下一個字元轉成大寫，連按兩下或長按都無法持續輸入大寫。按鍵觸控層沒有 Shift 長按動作，輸入服務也會在每次輸出後清除 Shift。

新增 ShiftState，統一管理單字大寫、大寫鎖定及連按時間。連按兩下 Shift（採 Android 系統的雙擊時限）或長按 400 毫秒啟用 Caps Lock，鍵面顯示 ⇪；再按 Shift 解除。其他按鍵會中斷連按序列，切換中英則重設 Shift 狀態，避免回到英文時意外持續大寫。

Caps Lock 啟用後，輸入服務保留大寫狀態；一般單按仍在輸出一字後還原。既有按鍵長按計時器直接支援 Shift，不增加相依套件。

驗證：testDebugUnitTest 與 assembleDebug 成功。Pixel 7 API 36 模擬器實際點擊軟體鍵盤，確認雙擊輸出 ABC、解除後輸出 a、長按輸出 AB、一般單按輸出 Ab，最終文字為 ABCaABAb。

功能提交：5739263。
