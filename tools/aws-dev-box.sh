#!/usr/bin/env bash
# Stand up (or re-attach to) the EC2 box where the repo and Claude Code live.
#
# The box holds the engine. It does not hold the town: shapes, markers,
# interiors and the loci photographs live in a *browser* profile, and the
# browser stays on your machine. So the box serves index.html over a port that
# only exists inside an SSH tunnel, and you play it at http://localhost:8080.
#
#   tools/aws-dev-box.sh up       # create key, security group, instance
#   tools/aws-dev-box.sh tunnel   # ssh in, forwarding 8080 -> the box
#   tools/aws-dev-box.sh stop     # stop billing for compute, keep the disk
#   tools/aws-dev-box.sh start    # bring it back
#   tools/aws-dev-box.sh ip       # print the current public address
#   tools/aws-dev-box.sh destroy  # delete instance, group and key
set -euo pipefail

REGION="${MQ_REGION:-ap-southeast-2}"          # Sydney: closest to Myrtleford
TYPE="${MQ_TYPE:-t4g.medium}"                  # 2 vCPU / 4 GB ARM, ~US$0.05/hr
NAME="memory-quest-le-dev"
KEY="$HOME/.ssh/${NAME}.pem"
REPO="ParseMeData/memory-quest-le"
AWS="${AWS:-$HOME/.local/bin/aws}"
say(){ printf '\n\033[1m%s\033[0m\n' "$*"; }

iid(){ "$AWS" ec2 describe-instances --region "$REGION" \
  --filters "Name=tag:Name,Values=$NAME" "Name=instance-state-name,Values=pending,running,stopping,stopped" \
  --query 'Reservations[].Instances[].InstanceId' --output text 2>/dev/null | awk '{print $1}'; }

pubip(){ "$AWS" ec2 describe-instances --region "$REGION" --instance-ids "$(iid)" \
  --query 'Reservations[].Instances[].PublicIpAddress' --output text; }

case "${1:-up}" in
up)
  [ -n "$(iid)" ] && { say "Already exists: $(iid) at $(pubip)"; exit 0; }

  say "Key pair"
  if [ ! -f "$KEY" ]; then
    "$AWS" ec2 delete-key-pair --region "$REGION" --key-name "$NAME" 2>/dev/null || true
    "$AWS" ec2 create-key-pair --region "$REGION" --key-name "$NAME" \
      --query KeyMaterial --output text > "$KEY"
    chmod 600 "$KEY"
  fi
  echo "  $KEY"

  say "Security group — SSH from this address only"
  MYIP="$(curl -sS https://checkip.amazonaws.com)"
  VPC="$("$AWS" ec2 describe-vpcs --region "$REGION" --filters Name=isDefault,Values=true \
        --query 'Vpcs[0].VpcId' --output text)"
  SG="$("$AWS" ec2 describe-security-groups --region "$REGION" \
        --filters "Name=group-name,Values=$NAME" --query 'SecurityGroups[0].GroupId' \
        --output text 2>/dev/null)"
  if [ "$SG" = "None" ] || [ -z "$SG" ]; then
    SG="$("$AWS" ec2 create-security-group --region "$REGION" --group-name "$NAME" \
          --description "Memory Quest LE dev box" --vpc-id "$VPC" --query GroupId --output text)"
  fi
  "$AWS" ec2 authorize-security-group-ingress --region "$REGION" --group-id "$SG" \
    --protocol tcp --port 22 --cidr "$MYIP/32" >/dev/null 2>&1 || true
  echo "  $SG  (ssh from $MYIP/32; port 8080 stays shut — the tunnel carries it)"

  say "Latest Ubuntu 24.04 arm64"
  AMI="$("$AWS" ssm get-parameters --region "$REGION" \
    --names /aws/service/canonical/ubuntu/server/24.04/stable/current/arm64/hvm/ebs-gp3/ami-id \
    --query 'Parameters[0].Value' --output text)"
  echo "  $AMI"

  say "Launching $TYPE"
  ID="$("$AWS" ec2 run-instances --region "$REGION" --image-id "$AMI" --instance-type "$TYPE" \
    --key-name "$NAME" --security-group-ids "$SG" \
    --block-device-mappings 'DeviceName=/dev/sda1,Ebs={VolumeSize=30,VolumeType=gp3}' \
    --metadata-options 'HttpTokens=required' \
    --tag-specifications "ResourceType=instance,Tags=[{Key=Name,Value=$NAME}]" \
    --user-data file://"$(dirname "$0")/aws-bootstrap.sh" \
    --query 'Instances[0].InstanceId' --output text)"
  "$AWS" ec2 wait instance-running --region "$REGION" --instance-ids "$ID"
  say "Up: $ID at $(pubip)"
  echo "The bootstrap installs Node, gh and Claude Code in the background —"
  echo "give it a couple of minutes, then:  $0 tunnel"
  ;;

tunnel)
  IP="$(pubip)"
  say "ssh -> $IP, forwarding localhost:8080"
  echo "Once in:  cd memory-quest-le && python3 -m http.server 8080"
  echo "Then open http://localhost:8080/index.html in Brave here."
  exec ssh -i "$KEY" -L 8080:localhost:8080 -o StrictHostKeyChecking=accept-new "ubuntu@$IP"
  ;;

ip)      pubip ;;
stop)    "$AWS" ec2 stop-instances  --region "$REGION" --instance-ids "$(iid)" --output table ;;
start)   "$AWS" ec2 start-instances --region "$REGION" --instance-ids "$(iid)" --output table
         "$AWS" ec2 wait instance-running --region "$REGION" --instance-ids "$(iid)"
         say "Back at $(pubip)  (the address changes every start)" ;;
destroy)
  say "This deletes the instance and its disk. Anything on the box not pushed is gone."
  read -rp "type 'destroy' to confirm: " ok; [ "$ok" = destroy ] || exit 1
  "$AWS" ec2 terminate-instances --region "$REGION" --instance-ids "$(iid)" --output table
  "$AWS" ec2 wait instance-terminated --region "$REGION" --instance-ids "$(iid)"
  "$AWS" ec2 delete-security-group --region "$REGION" --group-name "$NAME" || true
  "$AWS" ec2 delete-key-pair --region "$REGION" --key-name "$NAME" || true
  rm -f "$KEY"
  ;;
*) echo "usage: $0 {up|tunnel|ip|stop|start|destroy}"; exit 1 ;;
esac
