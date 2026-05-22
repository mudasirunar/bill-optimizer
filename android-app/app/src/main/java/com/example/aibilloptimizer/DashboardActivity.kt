package com.example.aibilloptimizer

import android.content.Intent
import android.os.Bundle
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import androidx.activity.enableEdgeToEdge
import androidx.appcompat.app.AppCompatActivity
import androidx.constraintlayout.widget.ConstraintLayout

class DashboardActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContentView(R.layout.activity_dashboard)

        val tvUsername = findViewById<TextView>(R.id.tv_username)
        val ivPfp = findViewById<ImageView>(R.id.iv_pfp)
        
        // Dynamic elements
        tvUsername.text = "Mudasir Unar" // Stubbed for now, linked to Firebase later

        // Banners
        val bannerLayout = findViewById<ConstraintLayout>(R.id.banner_layout)
        bannerLayout.setOnClickListener {
            val intent = Intent(this, SetupProfileActivity::class.java)
            startActivity(intent)
        }

        // Main Modules stack clicking routing
        val cardPrediction = findViewById<ConstraintLayout>(R.id.card_prediction)
        val cardForecaster = findViewById<ConstraintLayout>(R.id.card_forecaster)
        val cardSimulator = findViewById<ConstraintLayout>(R.id.card_simulator)

        cardPrediction.setOnClickListener {
            val intent = Intent(this, PredictionHubActivity::class.java)
            startActivity(intent)
        }

        cardForecaster.setOnClickListener {
            val intent = Intent(this, LoadForecasterActivity::class.java)
            startActivity(intent)
        }

        cardSimulator.setOnClickListener {
            val intent = Intent(this, ApplianceSimulatorActivity::class.java)
            startActivity(intent)
        }

        // Quick Links Grid
        val qlProfile = findViewById<LinearLayout>(R.id.ql_profile)
        val qlHistory = findViewById<LinearLayout>(R.id.ql_history)
        val qlNepra = findViewById<LinearLayout>(R.id.ql_nepra)
        val qlAbout = findViewById<LinearLayout>(R.id.ql_about)

        qlProfile.setOnClickListener {
            val intent = Intent(this, SetupProfileActivity::class.java)
            startActivity(intent)
        }

        qlHistory.setOnClickListener {
            val intent = Intent(this, AiMemoryActivity::class.java)
            startActivity(intent)
        }

        qlNepra.setOnClickListener {
            val intent = Intent(this, NepraInfoActivity::class.java)
            startActivity(intent)
        }

        qlAbout.setOnClickListener {
            Toast.makeText(
                this,
                "SSUET FYP 2026 - Smart Energy bill optimizer neural network simulation v1.0",
                Toast.LENGTH_LONG
            ).show()
        }

        // Click Avatar Action
        ivPfp.setOnClickListener {
            Toast.makeText(this, "Logged in as mudasir@ssuet.edu.pk", Toast.LENGTH_SHORT).show()
        }
    }
}
