#!/usr/bin/env python3
"""
Script de Déploiement Ultra-Rapide (ZIP) du Dashboard Nuxt 3 (Zemy) sur PlanetHoster
Auteur: Antigravity AI
"""

import os
import sys
import zipfile
import subprocess
import paramiko

# --- Configuration du Serveur ---
HOSTNAME = "node239-eu.n0c.com"
PORT = 5022
USERNAME = "ewnhmjym"
PASSWORD = "H6aYpcsK9NEzAm"

LOCAL_DASHBOARD_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "dashboard"))
LOCAL_OUTPUT_DIR = os.path.join(LOCAL_DASHBOARD_DIR, ".output")
LOCAL_ZIP_PATH = os.path.join(LOCAL_DASHBOARD_DIR, "output_deploy.zip")
REMOTE_DASHBOARD_DIR = "/home/ewnhmjym/zemy/dashboard"
REMOTE_ZIP_PATH = "/home/ewnhmjym/zemy/dashboard/output_deploy.zip"

def make_zip():
    print("Creation de l'archive ZIP (.output.zip)...")
    if os.path.exists(LOCAL_ZIP_PATH):
        os.remove(LOCAL_ZIP_PATH)
        
    with zipfile.ZipFile(LOCAL_ZIP_PATH, 'w', zipfile.ZIP_DEFLATED) as zipf:
        for root, dirs, files in os.walk(LOCAL_OUTPUT_DIR):
            for file in files:
                abs_file = os.path.join(root, file)
                rel_file = os.path.relpath(abs_file, LOCAL_OUTPUT_DIR)
                zipf.write(abs_file, os.path.join(".output", rel_file))
    print(f"Archive creee avec succes : {os.path.getsize(LOCAL_ZIP_PATH) / 1024 / 1024:.2f} MB")

def main():
    if not os.path.exists(LOCAL_OUTPUT_DIR):
        print("Build local non trouve. Generation du build Nuxt...")
        subprocess.run(["npm", "run", "build"], cwd=LOCAL_DASHBOARD_DIR, check=True, shell=True)

    make_zip()

    print(f"\nConnexion a {HOSTNAME}:{PORT} sous l'utilisateur '{USERNAME}'...")
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())

    try:
        ssh.connect(HOSTNAME, port=PORT, username=USERNAME, password=PASSWORD, timeout=30)
        print("Connexion SSH reussie !")

        sftp = ssh.open_sftp()
        print(f"Televersement ultra-rapide de output_deploy.zip...")
        sftp.put(LOCAL_ZIP_PATH, REMOTE_ZIP_PATH)
        sftp.close()
        print("Transfert SFTP termine.")

        def run_cmd(cmd):
            print(f"\nExecution : {cmd}")
            stdin, stdout, stderr = ssh.exec_command(cmd)
            out = stdout.read().decode('utf-8', errors='ignore').strip()
            err = stderr.read().decode('utf-8', errors='ignore').strip()
            if out:
                print(f"[STDOUT]\n{out}")
            if err:
                print(f"[STDERR]\n{err}")
            return out, err

        # Unzip et redémarrer
        run_cmd(f"cd {REMOTE_DASHBOARD_DIR} && unzip -o output_deploy.zip && rm -f output_deploy.zip")
        
        print("\nRedemarrage du service Dashboard en arriere-plan...")
        run_cmd("pkill -f 'node .output/server/index.mjs'")
        run_cmd("sleep 2")
        run_cmd("nohup /home/ewnhmjym/zemy/start_dashboard.sh > /home/ewnhmjym/zemy/dashboard.log 2>&1 &")
        run_cmd("sleep 2")
        run_cmd("pgrep -f 'node .output/server/index.mjs'")

        print("\nDeploiement du Dashboard en ligne termine avec succes !")

    except Exception as e:
        print(f"\nErreur durant le deploiement : {e}")
    finally:
        ssh.close()
        if os.path.exists(LOCAL_ZIP_PATH):
            os.remove(LOCAL_ZIP_PATH)

if __name__ == "__main__":
    main()
