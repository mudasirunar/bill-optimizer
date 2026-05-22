package com.example.aibilloptimizer

import android.content.Intent
import android.os.Bundle
import android.text.InputType
import android.view.View
import android.widget.Button
import android.widget.EditText
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import androidx.activity.enableEdgeToEdge
import androidx.appcompat.app.AppCompatActivity

class LoginActivity : AppCompatActivity() {

    private var isPasswordVisible = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContentView(R.layout.activity_login)

        val etEmail = findViewById<EditText>(R.id.et_email)
        val etPassword = findViewById<EditText>(R.id.et_password)
        val btnSignin = findViewById<Button>(R.id.btn_signin)
        val btnGoogle = findViewById<Button>(R.id.btn_google)
        val linkSignup = findViewById<TextView>(R.id.link_signup)
        val btnTogglePassword = findViewById<ImageView>(R.id.btn_toggle_password)
        val errorLayout = findViewById<LinearLayout>(R.id.error_layout)
        val errorText = findViewById<TextView>(R.id.error_text)

        // Toggle Password visibility
        btnTogglePassword.setOnClickListener {
            if (isPasswordVisible) {
                etPassword.inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_PASSWORD
                btnTogglePassword.setImageResource(android.R.drawable.ic_menu_view)
            } else {
                etPassword.inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_VISIBLE_PASSWORD
                btnTogglePassword.setImageResource(android.R.drawable.ic_secure) // Changes eye style
            }
            isPasswordVisible = !isPasswordVisible
            // Move cursor to end of text
            etPassword.setSelection(etPassword.text.length)
        }

        // Navigate to Sign Up
        linkSignup.setOnClickListener {
            val intent = Intent(this, SignupActivity::class.java)
            startActivity(intent)
        }

        // Mock login verification
        btnSignin.setOnClickListener {
            val email = etEmail.text.toString().trim()
            val password = etPassword.text.toString().trim()

            if (email.isEmpty() || password.isEmpty()) {
                errorText.text = "Please fill in all input fields."
                errorLayout.visibility = View.VISIBLE
            } else {
                errorLayout.visibility = View.GONE
                Toast.makeText(this, "Sign-In Successful!", Toast.LENGTH_SHORT).show()
                
                // Launch Dashboard
                val intent = Intent(this, DashboardActivity::class.java)
                startActivity(intent)
                finish()
            }
        }

        // Google sign-in action
        btnGoogle.setOnClickListener {
            Toast.makeText(this, "Connecting with Google...", Toast.LENGTH_SHORT).show()
            val intent = Intent(this, DashboardActivity::class.java)
            startActivity(intent)
            finish()
        }
    }
}
