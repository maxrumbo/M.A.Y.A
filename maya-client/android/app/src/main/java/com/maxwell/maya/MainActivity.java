package com.maxwell.maya;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(MayaNativePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
