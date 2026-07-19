function openTermsModal(event) {
            if (event) event.preventDefault();
            document.getElementById('terms-modal').style.display = 'flex';
            document.body.style.overflow = 'hidden';
        }
        function closeTermsModal() {
            document.getElementById('terms-modal').style.display = 'none';
            document.body.style.overflow = '';
        }
        window.addEventListener('click', function(event) {
            const modal = document.getElementById('terms-modal');
            if (event.target === modal) {
                closeTermsModal();
            }
        });

        function showRules(visible) { document.getElementById('pass-rules').style.display = visible ? 'block' : 'none'; }
        function togglePass(id, icon) {
            const input = document.getElementById(id);
            if (input.type === 'password') {
                input.type = 'text';
                icon.classList.replace('fa-eye', 'fa-eye-slash');
            } else {
                input.type = 'password';
                icon.classList.replace('fa-eye-slash', 'fa-eye');
            }
        }

        function checkStrength(val) {
            const segs = [document.getElementById('s1'), document.getElementById('s2'),
            document.getElementById('s3'), document.getElementById('s4')];
            segs.forEach(s => { s.className = 'strength-seg'; });
            if (!val) return;
            let score = 0;
            if (val.length >= 6) score++;
            if (val.length >= 10) score++;
            if (/[A-Z]/.test(val) && /[0-9]/.test(val)) score++;
            if (/[^A-Za-z0-9]/.test(val)) score++;
            const cls = score <= 1 ? 'weak' : score <= 2 ? 'medium' : 'strong';
            for (let i = 0; i < score; i++) segs[i].classList.add(cls);
        }

        function submitSignup() {
            handleSignUp(
                document.getElementById('fname').value,
                document.getElementById('lname').value,
                document.getElementById('email').value,
                document.getElementById('pass').value,
                document.getElementById('confirm-pass').value
            );
        }

        // Update checkStrength to match new 8-char rule
        function checkStrength(val) {
            const segs = [document.getElementById('s1'), document.getElementById('s2'), document.getElementById('s3'), document.getElementById('s4')];
            segs.forEach(s => s.className = 'strength-seg');
            if (!val) return;
            let score = 0;
            if (val.length >= 8) score++;
            if (/[A-Z]/.test(val)) score++;
            if (/[0-9]/.test(val)) score++;
            if (/[^A-Za-z0-9]/.test(val)) score++;

            const cls = score <= 1 ? 'weak' : score <= 2 ? 'medium' : 'strong';
            for (let i = 0; i < score; i++) segs[i].classList.add(cls);
        }
