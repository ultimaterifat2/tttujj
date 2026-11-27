package com.wevlo.atttujj;

import android.app.Activity;
import android.os.Bundle;
import android.view.Gravity;
import android.widget.TextView;

public class MainActivity extends Activity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        TextView t = new TextView(this);
        t.setText("Hello from Wevlo!");
        t.setTextSize(24);
        t.setGravity(Gravity.CENTER);
        setContentView(t);
    }
}
